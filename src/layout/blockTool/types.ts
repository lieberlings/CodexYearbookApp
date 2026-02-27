import { SlotOverride } from "../../state/editorStore";

export type RectN = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PointN = {
  x: number;
  y: number;
};

export type SlotMeta = {
  baseAspect: number;
  weight: number;
  preferredCenter?: PointN;
};

export type EngineParams = {
  gap: number;
  alpha: number;
  gamma: number;
  wFill: number;
  wMove: number;
  wSlack: number;
  wCentroid: number;
  wAxis: number;
  wAlign: number;
  wAspect: number;
  centroidTargetY: number;
  alignTol?: number;
  iterations: number;
  springK: number;
  epsilon: number;
  scales: number[];
};

export type EngineInput = {
  pageId: string;
  baseSlots: { id: string; role: "hero" | "photo"; frame: RectN }[];
  previousFramesById: Record<string, RectN>;
  userLockedOverridesById: Record<string, SlotOverride>;
  metasById: Record<string, SlotMeta>;
  obstacles?: RectN[];
};

export type EngineOutput = {
  framesBySlotId: Record<string, RectN>;
  score: number;
  fill: number;
  move: number;
  slackImbalance: number;
  centroidError: number;
  axisError: number;
  alignBonus: number;
  usedScale: number;
  hadOverlaps: boolean;
};

export type EnhanceParams = {
  maxLockedMove: number;
  maxLockedScale: number;
  iterations: number;
  preferHero: boolean;
  onlyNearCenter: boolean;
  nearCenterThreshold: number;
};

export type AutoPlacementInput = {
  id: string;
  width: number;
  height: number;
  startCenter: PointN;
  preferredCenter: PointN;
};

export type SolverInput = {
  bounds: RectN;
  gap: number;
  autos: AutoPlacementInput[];
  lockedRects: RectN[];
  iterations: number;
  springK: number;
  epsilon: number;
};

export type SolverOutput = {
  rectsById: Record<string, RectN>;
  residual: number;
  outOfBounds: number;
  hadOverlaps: boolean;
};

export function hasGeometryOverride(override?: SlotOverride): boolean {
  if (!override) {
    return false;
  }
  return (
    override.x !== undefined ||
    override.y !== undefined ||
    override.width !== undefined ||
    override.height !== undefined
  );
}

export function isUserLocked(
  slotId: string,
  userLockedOverridesById: Record<string, SlotOverride>
): boolean {
  return hasGeometryOverride(userLockedOverridesById[slotId]);
}

export const DEFAULT_ENGINE_PARAMS: EngineParams = {
  gap: 0.02,
  alpha: 0.8,
  gamma: 0.3,
  wFill: 1.0,
  wMove: 0.1,
  wSlack: 0.3,
  wCentroid: 0.2,
  wAxis: 0.1,
  wAlign: 0.05,
  wAspect: 0.0,
  centroidTargetY: 0.52,
  alignTol: undefined,
  iterations: 80,
  springK: 0.08,
  epsilon: 0.0008,
  scales: [1.0, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82, 0.79]
};

export const DEFAULT_ENHANCE_PARAMS: EnhanceParams = {
  maxLockedMove: 0.03,
  maxLockedScale: 0.08,
  iterations: 10,
  preferHero: true,
  onlyNearCenter: true,
  nearCenterThreshold: 0.12
};
