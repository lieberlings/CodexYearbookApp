import { useEffect, useRef, useState } from "react";
import { recordSnapshot, travelSnapshot } from "./pageHistory";

// Snapshot only the current memory's page data and overrides, never other projects.
export function usePageHistory<T>(key: string, value: T, restore: (value: T) => void) {
  const serialized = JSON.stringify(value);
  const latest = useRef(serialized);
  latest.current = serialized;
  const history = useRef({ key, past: [] as string[], present: serialized, future: [] as string[] });
  const active = useRef(false);
  const restoring = useRef<string | undefined>(undefined);
  const [, refresh] = useState(0);
  if (history.current.key !== key) {
    history.current = { key, past: [], present: serialized, future: [] };
    active.current = false;
    restoring.current = undefined;
  }
  function commit() {
    const h = history.current;
    if (restoring.current) return;
    if (recordSnapshot(h, latest.current)) refresh(n => n + 1);
  }
  useEffect(() => {
    if (restoring.current) {
      if (serialized === restoring.current) restoring.current = undefined;
      return;
    }
    if (active.current) return;
    const timer = setTimeout(commit, 400);
    return () => clearTimeout(timer);
  });
  function travel(redo: boolean) {
    commit();
    const next = travelSnapshot(history.current, redo);
    if (next === undefined) return;
    restoring.current = next;
    restore(JSON.parse(next));
    refresh(n => n + 1);
  }
  return { canUndo: history.current.past.length > 0 || serialized !== history.current.present,
    canRedo: history.current.future.length > 0,
    undo: () => travel(false), redo: () => travel(true),
    begin: () => { if (!active.current) commit(); active.current = true; },
    end: () => { active.current = false; refresh(n => n + 1); } };
}
