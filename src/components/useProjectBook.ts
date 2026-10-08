import { useMemo } from "react";
import { useAppData } from "../context/AppContext";
import { buildLayoutDocument } from "../layout/engine";
import { applySlotOverridesToPage } from "../layout/overrides";
import { useEditorStore } from "../state/editorStore";

export function useProjectBook(projectId: string) {
  const { getProjectById, getMemoriesByProjectId, getPhotosByMemoryId, getPageSectionsByMemoryId } = useAppData();
  const overrides = useEditorStore(state => state.slotOverridesByPage);
  const project = getProjectById(projectId);
  return useMemo(() => {
    const memories = getMemoriesByProjectId(projectId);
    const photos = Object.fromEntries(memories.map(memory => [memory.id, getPhotosByMemoryId(memory.id)]));
    const sections = Object.fromEntries(memories.map(memory => [memory.id, getPageSectionsByMemoryId(memory.id)]));
    const pages = project ? buildLayoutDocument(project, memories, photos, sections).pages.map(page => applySlotOverridesToPage(page, overrides[page.id])) : [];
    const frontMemory = memories.find(memory => memory.bookRole === "front-cover");
    const backMemory = memories.find(memory => memory.bookRole === "back-cover");
    return { project, memories, pages, sections, photosById: Object.fromEntries(Object.values(photos).flat().map(photo => [photo.id, photo])),
      front: pages.find(page => page.memoryId === frontMemory?.id), back: pages.find(page => page.memoryId === backMemory?.id) };
  }, [getMemoriesByProjectId, getPhotosByMemoryId, getPageSectionsByMemoryId, overrides, project, projectId]);
}
