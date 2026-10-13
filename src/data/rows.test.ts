import { describe, expect, it } from "@jest/globals";
import { AppData } from "../types";
import { diffAppData, diffCollection, emptySnapshot, planPositions, RowState, snapshotAppData } from "./rows";

const row = (json: string, position = 0, projectId: string | null = "p"): RowState => ({ json, position, projectId });

function isStrictlyIncreasing(values: number[]) {
  return values.every((value, index) => index === 0 || value > values[index - 1]);
}

describe("planPositions", () => {
  it("numbers a fresh list by index", () => {
    expect(planPositions(["a", "b", "c"], new Map())).toEqual([0, 1, 2]);
  });

  it("keeps every position when order is unchanged, including after removals", () => {
    const previous = new Map([["a", 0], ["b", 1], ["c", 2]]);
    expect(planPositions(["a", "b", "c"], previous)).toEqual([0, 1, 2]);
    expect(planPositions(["a", "c"], previous)).toEqual([0, 2]);
  });

  it("only gives prepended, appended and inserted ids new positions", () => {
    const previous = new Map([["a", 0], ["b", 1], ["c", 2]]);
    expect(planPositions(["x", "y", "a", "b", "c"], previous)).toEqual([-2, -1, 0, 1, 2]);
    expect(planPositions(["a", "b", "c", "z"], previous)).toEqual([0, 1, 2, 3]);
    expect(planPositions(["a", "m", "b", "c"], previous)).toEqual([0, 0.5, 1, 2]);
  });

  it("repositions only the moved id", () => {
    const previous = new Map([["a", 0], ["b", 1], ["c", 2], ["d", 3]]);
    const next = planPositions(["d", "a", "b", "c"], previous);
    expect(next.slice(1)).toEqual([0, 1, 2]);
    expect(next[0]).toBeLessThan(0);
  });

  it("renumbers when repeated inserts exhaust float precision", () => {
    let previous = new Map([["a", 1], ["b", 2]]);
    let ids = ["a", "b"];
    let renumbered = false;
    for (let i = 0; i < 80; i += 1) {
      ids = [ids[0], `n${i}`, ...ids.slice(1)];
      const positions = planPositions(ids, previous);
      expect(isStrictlyIncreasing(positions)).toBe(true);
      renumbered ||= positions.every((position, index) => position === index);
      previous = new Map(ids.map((id, index) => [id, positions[index]]));
    }
    expect(renumbered).toBe(true);
  });
});

describe("diffCollection", () => {
  it("upserts new and changed rows and deletes removed ones", () => {
    const previous = new Map([["same", row("{}")], ["changed", row('{"a":1}')], ["gone", row("{}")]]);
    const next = new Map([["same", row("{}")], ["changed", row('{"a":2}')], ["new", row("{}")]]);
    const diff = diffCollection(previous, next);
    expect(diff.upserts.map((write) => write.id).sort()).toEqual(["changed", "new"]);
    expect(diff.deletes).toEqual(["gone"]);
  });

  it("treats a moved row or a new project_id as a change", () => {
    const previous = new Map([["a", row("{}", 0, "p1")], ["b", row("{}", 1, "p1")]]);
    const next = new Map([["a", row("{}", 2, "p1")], ["b", row("{}", 1, "p2")]]);
    expect(diffCollection(previous, next).upserts.map((write) => write.id)).toEqual(["a", "b"]);
  });

  it("compares by JSON, not object identity", () => {
    const data: AppData = {
      projects: [{ id: "p", name: "Trip", createdAt: "t", updatedAt: "t" } as AppData["projects"][number]],
      memories: [],
      pageSections: [],
      photos: [],
      suggestions: []
    };
    const first = snapshotAppData(data).snapshot;
    const recreated = snapshotAppData({ ...data, projects: data.projects.map((project) => ({ ...project })) }, first).snapshot;
    expect(diffAppData(first, recreated).projects).toEqual({ upserts: [], deletes: [] });
  });
});

describe("snapshotAppData", () => {
  const data: AppData = {
    projects: [{ id: "p1", name: "Trip", createdAt: "t", updatedAt: "t" } as AppData["projects"][number]],
    memories: [{ id: "m1", projectId: "p1", title: "Beach", kind: "event", status: "active", order: 0, createdAt: "t", updatedAt: "t" }],
    pageSections: [{ id: "s1", memoryId: "m1", order: 0, photoIds: [] }],
    photos: [{ id: "ph1", projectId: "p1", memoryId: "m1", uri: "file:///a.jpg", exportDataUri: "data:abc", capturedAt: "t", addedAt: "t" }],
    suggestions: []
  };

  it("strips exportDataUri and fills project_id where it applies", () => {
    const { snapshot, problems } = snapshotAppData(data);
    expect(problems).toEqual([]);
    expect(snapshot.projects.get("p1")?.projectId).toBeNull();
    expect(snapshot.memories.get("m1")?.projectId).toBe("p1");
    expect(snapshot.pageSections.get("s1")?.projectId).toBe("p1");
    expect(JSON.parse(snapshot.photos.get("ph1")!.json)).not.toHaveProperty("exportDataUri");
    expect(diffAppData(emptySnapshot(), snapshot).photos.upserts).toHaveLength(1);
  });

  it("keeps the first of duplicate ids and reports the rest", () => {
    const { snapshot, problems } = snapshotAppData({ ...data, memories: [...data.memories, { ...data.memories[0], title: "Dupe" }] });
    expect(snapshot.memories.size).toBe(1);
    expect(JSON.parse(snapshot.memories.get("m1")!.json).title).toBe("Beach");
    expect(problems).toEqual([{ collection: "memories", id: "m1", reason: "duplicate-id" }]);
  });
});
