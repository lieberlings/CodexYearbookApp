// Pure helpers that turn AppData into per-table rows and work out the minimal
// set of writes between two snapshots. No I/O here so it is easy to unit test.
import { AppData } from "../types";
import { stripPhotoExportData } from "./normalize";
import { COLLECTION_KEYS, CollectionKey } from "./schema";

export type RowState = {
  projectId: string | null;
  position: number;
  // The record exactly as it is written to the data column. AppContext often
  // recreates objects, so change detection compares this string, not identity.
  json: string;
};

export type CollectionSnapshot = Map<string, RowState>;
export type AppDataSnapshot = Record<CollectionKey, CollectionSnapshot>;

export type RowWrite = RowState & { id: string };
export type CollectionDiff = { upserts: RowWrite[]; deletes: string[] };
export type AppDataDiff = Record<CollectionKey, CollectionDiff>;

export type SnapshotProblem = { collection: CollectionKey; id: unknown; reason: "duplicate-id" | "missing-id" };

export function emptySnapshot(): AppDataSnapshot {
  return {
    projects: new Map(),
    memories: new Map(),
    pageSections: new Map(),
    photos: new Map(),
    suggestions: new Map()
  };
}

// Assigns each id a sort position that preserves array order while reusing as
// many previous positions as possible: the longest run of records whose
// relative order is unchanged keeps its positions, and only new or moved
// records get fresh positions in the gaps. Prepending a photo therefore writes
// one row instead of renumbering the whole table.
export function planPositions(ids: readonly string[], previous: ReadonlyMap<string, number>): number[] {
  const n = ids.length;
  const old = ids.map((id) => previous.get(id));

  // Longest strictly increasing subsequence of the known previous positions.
  const tails: number[] = [];
  const parent = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i += 1) {
    const value = old[i];
    if (value === undefined || !Number.isFinite(value)) {
      continue;
    }
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((old[tails[mid]] as number) < value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    parent[i] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = i;
  }
  const keep = new Array<boolean>(n).fill(false);
  for (let i = tails.length > 0 ? tails[tails.length - 1] : -1; i >= 0; i = parent[i]) {
    keep[i] = true;
  }

  const out = new Array<number>(n);
  let lastAnchor: number | undefined;
  let i = 0;
  while (i < n) {
    if (keep[i]) {
      out[i] = old[i] as number;
      lastAnchor = out[i];
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && !keep[j]) {
      j += 1;
    }
    const count = j - i;
    const nextAnchor = j < n ? (old[j] as number) : undefined;
    for (let k = 0; k < count; k += 1) {
      if (lastAnchor === undefined && nextAnchor === undefined) {
        out[i + k] = k;
      } else if (lastAnchor === undefined) {
        out[i + k] = (nextAnchor as number) - (count - k);
      } else if (nextAnchor === undefined) {
        out[i + k] = lastAnchor + k + 1;
      } else {
        out[i + k] = lastAnchor + ((nextAnchor - lastAnchor) * (k + 1)) / (count + 1);
      }
    }
    i = j;
  }

  // Repeated inserts into the same gap eventually run out of float precision;
  // fall back to renumbering everything.
  for (let k = 0; k < n; k += 1) {
    if (!Number.isFinite(out[k]) || (k > 0 && out[k] <= out[k - 1])) {
      return ids.map((_, index) => index);
    }
  }
  return out;
}

function positionsOf(snapshot: CollectionSnapshot | undefined): Map<string, number> {
  const positions = new Map<string, number>();
  snapshot?.forEach((row, id) => positions.set(id, row.position));
  return positions;
}

type RowSource = { id: string; projectId: string | null; json: string };

function sourceRows(key: CollectionKey, data: AppData, memoryProjectIds: Map<string, string>): { id: unknown; build: () => RowSource }[] {
  switch (key) {
    case "projects":
      return data.projects.map((record) => ({
        id: record?.id,
        build: () => ({ id: record.id, projectId: null, json: JSON.stringify(record) })
      }));
    case "memories":
      return data.memories.map((record) => ({
        id: record?.id,
        build: () => ({ id: record.id, projectId: record.projectId ?? null, json: JSON.stringify(record) })
      }));
    case "pageSections":
      return data.pageSections.map((record) => ({
        id: record?.id,
        build: () => ({ id: record.id, projectId: memoryProjectIds.get(record.memoryId) ?? null, json: JSON.stringify(record) })
      }));
    case "photos":
      return data.photos.map((record) => ({
        id: record?.id,
        build: () => ({ id: record.id, projectId: record.projectId ?? null, json: JSON.stringify(stripPhotoExportData(record)) })
      }));
    case "suggestions":
      return data.suggestions.map((record) => ({
        id: record?.id,
        build: () => ({ id: record.id, projectId: record.projectId ?? null, json: JSON.stringify(record) })
      }));
  }
}

// Serializes every record. Records without an id, and repeats of an id already
// seen, cannot be stored under the id primary key; they are skipped (first
// occurrence wins) and reported so the caller can decide how loud to be.
export function snapshotAppData(
  data: AppData,
  previous?: AppDataSnapshot
): { snapshot: AppDataSnapshot; problems: SnapshotProblem[] } {
  const snapshot = emptySnapshot();
  const problems: SnapshotProblem[] = [];
  const memoryProjectIds = new Map<string, string>();
  for (const memory of data.memories) {
    if (memory && typeof memory.id === "string" && typeof memory.projectId === "string" && !memoryProjectIds.has(memory.id)) {
      memoryProjectIds.set(memory.id, memory.projectId);
    }
  }

  for (const key of COLLECTION_KEYS) {
    const rows: RowSource[] = [];
    const seen = new Set<string>();
    for (const source of sourceRows(key, data, memoryProjectIds)) {
      if (typeof source.id !== "string" || source.id.length === 0) {
        problems.push({ collection: key, id: source.id, reason: "missing-id" });
        continue;
      }
      if (seen.has(source.id)) {
        problems.push({ collection: key, id: source.id, reason: "duplicate-id" });
        continue;
      }
      seen.add(source.id);
      rows.push(source.build());
    }
    const positions = planPositions(rows.map((row) => row.id), positionsOf(previous?.[key]));
    rows.forEach((row, index) => {
      snapshot[key].set(row.id, { projectId: row.projectId, position: positions[index], json: row.json });
    });
  }
  return { snapshot, problems };
}

export function diffCollection(previous: CollectionSnapshot, next: CollectionSnapshot): CollectionDiff {
  const upserts: RowWrite[] = [];
  const deletes: string[] = [];
  next.forEach((row, id) => {
    const before = previous.get(id);
    if (!before || before.json !== row.json || before.position !== row.position || before.projectId !== row.projectId) {
      upserts.push({ id, ...row });
    }
  });
  previous.forEach((_, id) => {
    if (!next.has(id)) {
      deletes.push(id);
    }
  });
  return { upserts, deletes };
}

export function diffAppData(previous: AppDataSnapshot, next: AppDataSnapshot): AppDataDiff {
  const diff = {} as AppDataDiff;
  for (const key of COLLECTION_KEYS) {
    diff[key] = diffCollection(previous[key], next[key]);
  }
  return diff;
}

export function isEmptyDiff(diff: AppDataDiff): boolean {
  return COLLECTION_KEYS.every((key) => diff[key].upserts.length === 0 && diff[key].deletes.length === 0);
}
