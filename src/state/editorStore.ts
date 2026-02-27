import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LayoutDocument } from "../layout/schemas";

export type SlotOverride = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  photoId?: string;
  fitMode?: "contain" | "cover";
  photoScale?: number;
  photoOffsetX?: number;
  photoOffsetY?: number;
};

type EditorState = {
  document: LayoutDocument | null;
  selectedPageId?: string;
  selectedSlotId?: string;
  slotOverridesByPage: Record<string, Record<string, SlotOverride>>;
  setDocument: (document: LayoutDocument) => void;
  setSelection: (pageId?: string, slotId?: string) => void;
  setSlotOverride: (pageId: string, slotId: string, patch: SlotOverride) => void;
  clearSlotOverride: (pageId: string, slotId: string) => void;
  clearPageOverrides: (pageId: string) => void;
  clearAllOverrides: () => void;
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      document: null,
      selectedPageId: undefined,
      selectedSlotId: undefined,
      slotOverridesByPage: {},
      setDocument: (document) => set(() => ({ document })),
      setSelection: (pageId, slotId) => set(() => ({ selectedPageId: pageId, selectedSlotId: slotId })),
      setSlotOverride: (pageId, slotId, patch) =>
        set((state) => ({
          slotOverridesByPage: {
            ...state.slotOverridesByPage,
            [pageId]: {
              ...(state.slotOverridesByPage[pageId] ?? {}),
              [slotId]: {
                ...(state.slotOverridesByPage[pageId]?.[slotId] ?? {}),
                ...patch
              }
            }
          }
        })),
      clearSlotOverride: (pageId, slotId) =>
        set((state) => {
          const pageOverrides = { ...(state.slotOverridesByPage[pageId] ?? {}) };
          delete pageOverrides[slotId];
          return {
            slotOverridesByPage: {
              ...state.slotOverridesByPage,
              [pageId]: pageOverrides
            }
          };
        }),
      clearPageOverrides: (pageId) =>
        set((state) => {
          const next = { ...state.slotOverridesByPage };
          delete next[pageId];
          return { slotOverridesByPage: next };
        }),
      clearAllOverrides: () => set(() => ({ slotOverridesByPage: {} }))
    }),
    {
      name: "yearbook-editor-overrides-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ slotOverridesByPage: state.slotOverridesByPage })
    }
  )
);
