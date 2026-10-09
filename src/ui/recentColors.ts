import { useSyncExternalStore } from "react";
import { pushRecentColor } from "./colorPickerModel";

// Colors picked during this app session, shared by every ColorPicker.
let recent: string[] = [];
const listeners = new Set<() => void>();

export function addRecentColor(color: string) {
  recent = pushRecentColor(recent, color);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRecentColors(): string[] {
  return useSyncExternalStore(subscribe, () => recent, () => recent);
}
