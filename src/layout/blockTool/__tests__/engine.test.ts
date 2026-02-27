import { describe, expect, it } from "@jest/globals";
import {
  clampToBounds,
  center,
  inflate,
  intersects,
  minSeparationVector
} from "../geometry";
import {
  buildInitialGridFrames,
  enhanceLayout,
  recomputeFrames,
  snapRectToValid,
  validateUserPlacement
} from "../engine";
import { computeAreaWeightedCentroid, computeSlackImbalance } from "../scoring";

function buildMetas(slots: { id: string; frame: { width: number; height: number } }[]) {
  return Object.fromEntries(
    slots.map((slot) => [
      slot.id,
      {
        baseAspect: slot.frame.width / Math.max(0.0001, slot.frame.height),
        weight: Math.max(0.0001, slot.frame.width * slot.frame.height)
      }
    ] as const)
  );
}

describe("blockTool geometry", () => {
  it("computes center, inflation, clamp and separation vector correctly", () => {
    const a = { x: 0.1, y: 0.1, width: 0.3, height: 0.2 };
    const b = { x: 0.32, y: 0.1, width: 0.3, height: 0.2 };

    const c = center(a);
    expect(c.x).toBeCloseTo(0.25, 6);
    expect(c.y).toBeCloseTo(0.2, 6);

    const inf = inflate(a, 0.05);
    expect(inf.x).toBeCloseTo(0.05, 6);
    expect(inf.width).toBeCloseTo(0.4, 6);

    const clamped = clampToBounds(
      { x: -0.1, y: 0.95, width: 0.3, height: 0.2 },
      { x: 0, y: 0, width: 1, height: 1 }
    );
    expect(clamped.x).toBeCloseTo(0, 6);
    expect(clamped.y).toBeCloseTo(0.8, 6);

    expect(intersects(a, b)).toBe(true);
    const sep = minSeparationVector(a, b);
    expect(sep.penetration).toBeGreaterThan(0);
    expect(Math.abs(sep.dx) + Math.abs(sep.dy)).toBeGreaterThan(0);
  });
});

describe("blockTool placement validation", () => {
  it("allows overlap with auto blocks when autos are not passed as locked, but rejects locked overlap", () => {
    const pageBounds = { x: 0, y: 0, width: 1, height: 1 };
    const gap = 0.02;
    const candidate = { x: 0.2, y: 0.2, width: 0.3, height: 0.3 };

    const autoRectOnly = validateUserPlacement({
      pageBounds,
      gap,
      candidateRect: candidate,
      lockedRects: []
    });
    expect(autoRectOnly.ok).toBe(true);

    const withLocked = validateUserPlacement({
      pageBounds,
      gap,
      candidateRect: candidate,
      lockedRects: [{ x: 0.25, y: 0.25, width: 0.25, height: 0.25 }]
    });
    expect(withLocked.ok).toBe(false);
    expect(withLocked.reason).toBe("overlap_locked");
  });

  it("snaps overlapping candidate to nearest valid position against locked rects", () => {
    const bounds = { x: 0.01, y: 0.01, width: 0.98, height: 0.98 };
    const locked = [{ x: 0.35, y: 0.35, width: 0.3, height: 0.3 }];
    const candidate = { x: 0.4, y: 0.4, width: 0.25, height: 0.25 };
    const snap = snapRectToValid({
      candidate,
      bounds,
      lockedRects: locked,
      gap: 0.02
    });
    expect(snap.ok).toBe(true);
    expect(snap.rect).toBeDefined();
    const snappedRect = snap.rect!;
    expect(snappedRect.x).toBeGreaterThanOrEqual(bounds.x - 1e-6);
    expect(snappedRect.y).toBeGreaterThanOrEqual(bounds.y - 1e-6);
    expect(snappedRect.x + snappedRect.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-6);
    expect(snappedRect.y + snappedRect.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-6);
    expect(intersects(inflate(snappedRect, 0.01), inflate(locked[0], 0.01))).toBe(false);
    const candidateCenter = center(candidate);
    const snappedCenter = center(snappedRect);
    expect(Math.hypot(snappedCenter.x - candidateCenter.x, snappedCenter.y - candidateCenter.y)).toBeLessThan(0.5);
  });
});

describe("blockTool scoring metrics", () => {
  it("computes area-weighted centroid correctly", () => {
    const framesById = {
      a: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
      b: { x: 0.7, y: 0.2, width: 0.2, height: 0.2 }
    };
    const rolesById = { a: "photo", b: "photo" } as const;
    const c = computeAreaWeightedCentroid(framesById, rolesById);
    expect(c.x).toBeCloseTo(0.5, 6);
    expect(c.y).toBeCloseTo(0.3, 6);
  });
});

describe("blockTool recompute", () => {
  it("centers a partial last row for odd initial counts", () => {
    const slots = buildInitialGridFrames(7, "heroFirst", "landscape");
    const frames = slots.map((slot) => slot.frame);
    const maxY = Math.max(...frames.map((frame) => frame.y));
    const lastRow = frames.filter((frame) => Math.abs(frame.y - maxY) < 1e-6);
    expect(lastRow.length).toBeGreaterThan(0);
    expect(lastRow.length).toBeLessThan(frames.length);

    const usable = { x: 0.01, y: 0.01, width: 0.98, height: 0.98 };
    const minX = Math.min(...lastRow.map((frame) => frame.x));
    const maxX = Math.max(...lastRow.map((frame) => frame.x + frame.width));
    const leftSlack = minX - usable.x;
    const rightSlack = usable.x + usable.width - maxX;
    expect(Math.abs(leftSlack - rightSlack)).toBeLessThanOrEqual(0.02);
  });

  it("keeps user-locked frames unchanged", () => {
    const slots = buildInitialGridFrames(6, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const locked = { x: 0.06, y: 0.08, width: 0.36, height: 0.5 };
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));

    const out = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: { [slots[0].id]: { ...locked } },
        metasById
      },
      { gap: 0.02 }
    );

    const next = out.framesBySlotId[slots[0].id];
    expect(next.x).toBeCloseTo(locked.x, 6);
    expect(next.y).toBeCloseTo(locked.y, 6);
    expect(next.width).toBeCloseTo(locked.width, 6);
    expect(next.height).toBeCloseTo(locked.height, 6);
  });

  it("keeps locked block aspect changes (keep-aspect off equivalent)", () => {
    const slots = buildInitialGridFrames(6, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const lockedSlot = slots[0];
    const baseAspect = lockedSlot.frame.width / Math.max(0.0001, lockedSlot.frame.height);
    const locked = {
      x: lockedSlot.frame.x,
      y: lockedSlot.frame.y,
      width: lockedSlot.frame.width * 0.7,
      height: lockedSlot.frame.height
    };

    const out = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: { [lockedSlot.id]: { ...locked } },
        metasById
      },
      { gap: 0.02 }
    );

    const next = out.framesBySlotId[lockedSlot.id];
    const nextAspect = next.width / Math.max(0.0001, next.height);
    const lockedAspect = locked.width / Math.max(0.0001, locked.height);
    expect(nextAspect).toBeCloseTo(lockedAspect, 6);
    expect(Math.abs(nextAspect - baseAspect)).toBeGreaterThan(0.01);
  });

  it("keeps auto frames in bounds and non-overlapping (gap-aware)", () => {
    const gap = 0.02;
    const slots = buildInitialGridFrames(9, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const out = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: {},
        metasById
      },
      { gap, iterations: 120 }
    );
    const frames = slots.map((slot) => out.framesBySlotId[slot.id]);
    const inset = gap / 2;

    for (const frame of frames) {
      expect(frame.x).toBeGreaterThanOrEqual(inset - 1e-4);
      expect(frame.y).toBeGreaterThanOrEqual(inset - 1e-4);
      expect(frame.x + frame.width).toBeLessThanOrEqual(1 - inset + 1e-4);
      expect(frame.y + frame.height).toBeLessThanOrEqual(1 - inset + 1e-4);
    }

    for (let i = 0; i < frames.length; i += 1) {
      for (let j = i + 1; j < frames.length; j += 1) {
        const a = inflate(frames[i], gap / 2 - 1e-4);
        const b = inflate(frames[j], gap / 2 - 1e-4);
        expect(intersects(a, b)).toBe(false);
      }
    }
  });

  it("shrinks autos when a locked block grows and keeps autos on-screen", () => {
    const slots = buildInitialGridFrames(8, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const baseline = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: {},
        metasById
      },
      { gap: 0.02 }
    );
    const lockedId = slots[0].id;
    const baseLocked = baseline.framesBySlotId[lockedId];
    const grownLocked = {
      x: baseLocked.x,
      y: baseLocked.y,
      width: Math.min(0.7, baseLocked.width * 1.8),
      height: Math.min(0.7, baseLocked.height * 1.8)
    };
    const withLargeLock = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById: baseline.framesBySlotId,
        userLockedOverridesById: { [lockedId]: grownLocked },
        metasById
      },
      { gap: 0.02, scales: [1, 0.95, 0.9, 0.85] }
    );

    expect(withLargeLock.usedScale).toBeLessThanOrEqual(baseline.usedScale);
    const autoIds = slots.map((slot) => slot.id).filter((id) => id !== lockedId);
    const baselineArea = autoIds.reduce((sum, id) => {
      const frame = baseline.framesBySlotId[id];
      return sum + frame.width * frame.height;
    }, 0);
    const shrunkArea = autoIds.reduce((sum, id) => {
      const frame = withLargeLock.framesBySlotId[id];
      return sum + frame.width * frame.height;
    }, 0);
    expect(shrunkArea).toBeLessThanOrEqual(baselineArea + 1e-6);

    for (const id of autoIds) {
      const frame = withLargeLock.framesBySlotId[id];
      expect(frame.x).toBeGreaterThanOrEqual(0.01 - 1e-4);
      expect(frame.y).toBeGreaterThanOrEqual(0.01 - 1e-4);
      expect(frame.x + frame.width).toBeLessThanOrEqual(0.99 + 1e-4);
      expect(frame.y + frame.height).toBeLessThanOrEqual(0.99 + 1e-4);
    }
  });

  it("preserves aspect ratios for auto blocks", () => {
    const slots = buildInitialGridFrames(7, "heroFirst", "portrait");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const out = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: {},
        metasById
      },
      { gap: 0.015, iterations: 120 }
    );

    for (const slot of slots) {
      const next = out.framesBySlotId[slot.id];
      const nextAspect = next.width / Math.max(0.0001, next.height);
      expect(nextAspect).toBeCloseTo(metasById[slot.id].baseAspect, 2);
    }
  });

  it("preserves relative area ratios by common scale factor", () => {
    const slots = buildInitialGridFrames(5, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const out = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: {},
        metasById
      },
      { gap: 0.02 }
    );

    const ratios = slots.map((slot) => {
      const frame = out.framesBySlotId[slot.id];
      return (frame.width * frame.height) / metasById[slot.id].weight;
    });
    const mean = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    for (const ratio of ratios) {
      expect(Math.abs(ratio - mean)).toBeLessThan(0.03);
    }
  });

  it("reduces slack imbalance versus initial frame layout", () => {
    const slots = buildInitialGridFrames(8, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const usableBounds = { x: 0.01, y: 0.01, width: 0.98, height: 0.98 };

    const initialSlack = computeSlackImbalance(usableBounds, Object.values(previousFramesById));
    const out = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: {},
        metasById
      },
      { gap: 0.02, gamma: 0.5 }
    );

    expect(out.slackImbalance).toBeLessThanOrEqual(initialSlack + 1e-6);
  });

  it("enhance layout keeps locked constraints and avoids locked overlap", () => {
    const gap = 0.02;
    const slots = buildInitialGridFrames(7, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const lockedA = slots[0].id;
    const lockedB = slots[1].id;
    const lockedOverrides = {
      [lockedA]: {
        x: previousFramesById[lockedA].x,
        y: previousFramesById[lockedA].y,
        width: previousFramesById[lockedA].width,
        height: previousFramesById[lockedA].height
      },
      [lockedB]: {
        x: previousFramesById[lockedB].x,
        y: previousFramesById[lockedB].y,
        width: previousFramesById[lockedB].width,
        height: previousFramesById[lockedB].height
      }
    };
    const out = enhanceLayout(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: lockedOverrides,
        metasById
      },
      { gap },
      { iterations: 4, onlyNearCenter: false }
    );
    expect(out.hadOverlaps).toBe(false);
    const a = out.framesBySlotId[lockedA];
    const b = out.framesBySlotId[lockedB];
    expect(a.x).toBeGreaterThanOrEqual(gap / 2 - 1e-4);
    expect(a.y).toBeGreaterThanOrEqual(gap / 2 - 1e-4);
    expect(a.x + a.width).toBeLessThanOrEqual(1 - gap / 2 + 1e-4);
    expect(a.y + a.height).toBeLessThanOrEqual(1 - gap / 2 + 1e-4);
    expect(intersects(inflate(a, gap / 2 - 1e-4), inflate(b, gap / 2 - 1e-4))).toBe(false);
  });

  it("enhance can improve centroid-focused score for off-center locked hero", () => {
    const slots = buildInitialGridFrames(6, "heroFirst", "landscape");
    const metasById = buildMetas(slots);
    const previousFramesById = Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
    const heroId = slots[0].id;
    const hero = previousFramesById[heroId];
    const lockedOverrides = {
      [heroId]: {
        x: Math.max(0.01, hero.x - 0.08),
        y: hero.y,
        width: hero.width,
        height: hero.height
      }
    };
    const params = {
      gap: 0.02,
      wFill: 0.4,
      wMove: 0.05,
      wSlack: 0.2,
      wCentroid: 2.5,
      wAxis: 0.6,
      wAlign: 0.05
    };
    const baseline = recomputeFrames(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById,
        userLockedOverridesById: lockedOverrides,
        metasById
      },
      params
    );
    const enhanced = enhanceLayout(
      {
        pageId: "p",
        baseSlots: slots.map((slot) => ({ id: slot.id, role: slot.role, frame: slot.frame })),
        previousFramesById: baseline.framesBySlotId,
        userLockedOverridesById: lockedOverrides,
        metasById
      },
      params,
      { iterations: 8, onlyNearCenter: false, maxLockedMove: 0.03, maxLockedScale: 0.08 }
    );

    expect(enhanced.hadOverlaps).toBe(false);
    expect(enhanced.centroidError).toBeLessThanOrEqual(baseline.centroidError + 1e-6);
    expect(enhanced.score).toBeGreaterThanOrEqual(baseline.score - 1e-6);
  });
});
