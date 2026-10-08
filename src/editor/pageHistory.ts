export type PageHistory = { key: string; past: string[]; present: string; future: string[] };

export function recordSnapshot(history: PageHistory, snapshot: string): boolean {
  if (history.present === snapshot) return false;
  history.past = [...history.past, history.present].slice(-80);
  history.present = snapshot;
  history.future = [];
  return true;
}

export function travelSnapshot(history: PageHistory, redo: boolean): string | undefined {
  const next = (redo ? history.future : history.past).pop();
  if (next === undefined) return;
  (redo ? history.past : history.future).push(history.present);
  history.present = next;
  return next;
}
