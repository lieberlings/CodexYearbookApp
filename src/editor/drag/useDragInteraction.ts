import { useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { getSettleRect, resolveDropAction } from "./dragController";
import { resolveHoverTarget } from "./dragTargets";
import { DragPayload, DragResolution, DragSession, DropTarget, Point } from "./types";

type UseDragInteractionOptions = {
  getTargets: () => DropTarget[];
  onCommit: (resolution: DragResolution) => void;
};

type OverlayAnimation = {
  position: Animated.ValueXY;
  scale: Animated.Value;
  opacity: Animated.Value;
};

export function useDragInteraction(options: UseDragInteractionOptions) {
  const [session, setSession] = useState<DragSession>({ lifecycle: "idle" });
  const sessionRef = useRef<DragSession>({ lifecycle: "idle" });
  const animation = useRef<OverlayAnimation>({
    position: new Animated.ValueXY({ x: 0, y: 0 }),
    scale: new Animated.Value(1),
    opacity: new Animated.Value(0)
  }).current;

  const updateSession = (next: DragSession) => {
    sessionRef.current = next;
    setSession(next);
  };

  function beginDrag(payload: DragPayload, startPoint: Point) {
    const grabOffset = {
      x: startPoint.x - payload.sourceRect.x,
      y: startPoint.y - payload.sourceRect.y
    };
    animation.position.setValue({ x: payload.sourceRect.x, y: payload.sourceRect.y });
    animation.scale.setValue(1);
    animation.opacity.setValue(1);
    Animated.timing(animation.scale, {
      toValue: 1.04,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
    updateSession({
      lifecycle: "dragging",
      payload,
      startPoint,
      currentPoint: startPoint,
      grabOffset
    });
  }

  function updateDrag(point: Point) {
    const active = sessionRef.current;
    if (active.lifecycle !== "dragging" || !active.payload || !active.grabOffset) {
      return;
    }
    animation.position.setValue({
      x: point.x - active.grabOffset.x,
      y: point.y - active.grabOffset.y
    });
    const targets = options.getTargets();
    const hoveredTarget = resolveHoverTarget(active.payload, point, targets, active.hoveredTarget);
    updateSession({
      ...active,
      currentPoint: point,
      hoveredTarget,
      resolution: resolveDropAction(active.payload, hoveredTarget)
    });
  }

  function finalizeDrop(nextLifecycle: "dropping" | "canceling", resolution: DragResolution, target?: DropTarget) {
    const active = sessionRef.current;
    if (!active.payload) {
      updateSession({ lifecycle: "idle" });
      return;
    }
    const settleRect = resolution.action === "cancel" ? active.payload.sourceRect : getSettleRect(active.payload, target);
    updateSession({
      ...active,
      lifecycle: nextLifecycle,
      resolution,
      hoveredTarget: target
    });
    if (resolution.action !== "cancel") {
      options.onCommit(resolution);
    }
    Animated.parallel([
      Animated.timing(animation.position, {
        toValue: { x: settleRect.x, y: settleRect.y },
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(animation.scale, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(animation.opacity, {
        toValue: nextLifecycle === "canceling" ? 0.7 : 0,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(() => {
      updateSession({ lifecycle: "idle" });
      animation.opacity.setValue(0);
      animation.scale.setValue(1);
    });
  }

  function endDrag() {
    const active = sessionRef.current;
    if (active.lifecycle !== "dragging" || !active.payload) {
      return;
    }
    const finalTarget = active.currentPoint
      ? resolveHoverTarget(active.payload, active.currentPoint, options.getTargets())
      : active.hoveredTarget;
    const resolution = resolveDropAction(active.payload, finalTarget);
    if (resolution.action === "cancel") {
      finalizeDrop("canceling", resolution, finalTarget);
      return;
    }
    finalizeDrop("dropping", resolution, finalTarget);
  }

  function cancelDrag() {
    const active = sessionRef.current;
    if (active.lifecycle !== "dragging" || !active.payload) {
      updateSession({ lifecycle: "idle" });
      return;
    }
    finalizeDrop("canceling", { action: "cancel" }, active.hoveredTarget);
  }

  const overlayStyle = useMemo(
    () => ({
      opacity: animation.opacity,
      transform: [
        { translateX: animation.position.x },
        { translateY: animation.position.y },
        { scale: animation.scale }
      ]
    }),
    [animation.opacity, animation.position.x, animation.position.y, animation.scale]
  );

  return {
    session,
    overlayStyle,
    beginDrag,
    updateDrag,
    endDrag,
    cancelDrag
  };
}
