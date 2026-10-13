import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { pushRecentColor } from "./colorPickerModel";

// Recently picked colors, shared by every ColorPicker and kept across app
// restarts. Saving is best effort: a failed read or write only loses the list.
const STORAGE_KEY = "yearbook.recentColors.v1";

let recent: string[] = [];
let picked = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const recentColorsLoaded: Promise<void> = AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    // A pick made before loading finished wins over the stored list.
    if (picked || !raw) {
      return;
    }
    const stored: unknown = JSON.parse(raw);
    if (Array.isArray(stored)) {
      recent = stored
        .filter((value): value is string => typeof value === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(value))
        .reduceRight((list, color) => pushRecentColor(list, color), [] as string[]);
      emit();
    }
  })
  .catch(() => undefined);

export function addRecentColor(color: string) {
  picked = true;
  recent = pushRecentColor(recent, color);
  emit();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recent)).catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentColors(): string[] {
  return recent;
}

export function useRecentColors(): string[] {
  return useSyncExternalStore(subscribe, getRecentColors, getRecentColors);
}
