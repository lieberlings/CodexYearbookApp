import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { makeId } from "../lib/id";
import { loadAppData, saveAppData } from "../storage";
import { Memory, MemoryPageSection, PageTextBox, PhotoItem, Project, ProjectType } from "../types";
import {
  copyImageToAppStorage,
  getCurrentLocation,
  pickImagesFromLibrary,
  pickSingleImageFromLibrary
} from "../services/photoService";

type AppContextValue = {
  loading: boolean;
  projects: Project[];
  memories: Memory[];
  pageSections: MemoryPageSection[];
  photos: PhotoItem[];
  pickProjectThumbnail: () => Promise<string | undefined>;
  createProject: (name: string, projectType: ProjectType, thumbnailUri?: string) => Promise<string>;
  updateProject: (projectId: string, updates: { name?: string; projectType?: ProjectType; thumbnailUri?: string }) => void;
  deleteProject: (projectId: string) => void;
  getProjectById: (id: string) => Project | undefined;
  createMemory: (projectId: string, title: string, themeLabel?: string) => Promise<string>;
  updateMemory: (memoryId: string, updates: { title?: string; themeLabel?: string }) => void;
  deleteMemory: (memoryId: string) => void;
  moveMemory: (projectId: string, memoryId: string, direction: "up" | "down") => void;
  reorderMemory: (projectId: string, memoryId: string, toIndex: number) => void;
  setMemoryPrimaryPhoto: (memoryId: string, photoId: string) => void;
  addPhotosToMemory: (memoryId: string) => Promise<number>;
  addPhotoAssetsToMemory: (
    memoryId: string,
    assets: { uri: string; fileName?: string | null; width?: number; height?: number }[]
  ) => Promise<string[]>;
  deletePhotos: (photoIds: string[]) => void;
  createPageSection: (memoryId: string) => void;
  deletePageSection: (pageSectionId: string, options?: { photoMode?: "merge" | "keep" | "discard" }) => void;
  reorderPageSection: (memoryId: string, pageSectionId: string, toIndex: number) => void;
  movePhotoToPage: (photoId: string, toPageSectionId: string, toIndex?: number) => void;
  removePhotoFromPage: (photoId: string) => void;
  swapPhotos: (sourcePhotoId: string, targetPhotoId: string) => void;
  addPageTextBox: (pageSectionId: string, initial?: Partial<PageTextBox>) => string | undefined;
  updatePageTextBox: (pageSectionId: string, textBoxId: string, updates: Partial<PageTextBox>) => void;
  deletePageTextBox: (pageSectionId: string, textBoxId: string) => void;
  setPageHero: (pageSectionId: string, photoId: string) => void;
  setPageSectionTemplate: (pageSectionId: string, templateId?: string) => void;
  updatePageSectionStyle: (
    pageSectionId: string,
    updates: Partial<
      Pick<
        MemoryPageSection,
        | "backgroundColor"
        | "slotBorderColor"
        | "slotBorderWidth"
        | "slotCornerRadius"
        | "textColor"
        | "textSize"
        | "textWeight"
        | "textFontFamily"
      >
    >
  ) => void;
  getMemoriesByProjectId: (projectId: string) => Memory[];
  getMemoryById: (id: string) => Memory | undefined;
  getPhotosByMemoryId: (memoryId: string) => PhotoItem[];
  getPageSectionsByMemoryId: (memoryId: string) => MemoryPageSection[];
  getMemoryThumbnailUri: (memoryId: string) => string | undefined;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

function sortByAddedAt(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

function normalizeSectionOrder(sections: MemoryPageSection[]): MemoryPageSection[] {
  return sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index }));
}

function reconcilePageSections(
  memories: Memory[],
  photos: PhotoItem[],
  rawSections: MemoryPageSection[]
): MemoryPageSection[] {
  const result: MemoryPageSection[] = [];
  const photosByMemory = new Map<string, PhotoItem[]>();
  const sectionsByMemory = new Map<string, MemoryPageSection[]>();

  for (const photo of photos) {
    const list = photosByMemory.get(photo.memoryId) ?? [];
    list.push(photo);
    photosByMemory.set(photo.memoryId, list);
  }

  for (const section of rawSections) {
    const list = sectionsByMemory.get(section.memoryId) ?? [];
    list.push(section);
    sectionsByMemory.set(section.memoryId, list);
  }

  for (const memory of memories) {
    const memoryPhotos = sortByAddedAt(photosByMemory.get(memory.id) ?? []);
    const photoIdSet = new Set(memoryPhotos.map((photo) => photo.id));
    const memorySections = normalizeSectionOrder(
      (sectionsByMemory.get(memory.id) ?? []).map((section) => {
        const uniqueValidPhotoIds = section.photoIds.filter((id, idx, arr) => arr.indexOf(id) === idx && photoIdSet.has(id));
        return {
          ...section,
          textBoxes: Array.isArray(section.textBoxes) ? section.textBoxes : [],
          photoIds: uniqueValidPhotoIds,
          heroPhotoId: section.heroPhotoId && uniqueValidPhotoIds.includes(section.heroPhotoId) ? section.heroPhotoId : undefined
        };
      })
    );

    const sections = memorySections.length > 0
      ? [...memorySections]
      : [
          {
            id: makeId("page"),
            memoryId: memory.id,
            order: 0,
            templateId: undefined,
            backgroundColor: undefined,
            slotBorderColor: undefined,
            slotBorderWidth: undefined,
            slotCornerRadius: undefined,
            textColor: undefined,
            textSize: undefined,
            textWeight: undefined,
            textFontFamily: undefined,
            textBoxes: [],
            photoIds: [],
            heroPhotoId: undefined
          }
        ];

    result.push(...normalizeSectionOrder(sections));
  }

  return result;
}

export function AppProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [pageSections, setPageSections] = useState<MemoryPageSection[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const data = await loadAppData();
      if (!mounted) {
        return;
      }

      let nextProjects = data.projects ?? [];
      let nextMemories = (data.memories ?? []).map((memory, index) => ({
        ...memory,
        order: typeof memory.order === "number" ? memory.order : index
      }));

      const hasLegacyMemories = nextMemories.some((memory) => !memory.projectId);
      if (hasLegacyMemories) {
        const now = new Date().toISOString();
        const importedProjectId = makeId("project");
        nextProjects = [
          {
            id: importedProjectId,
            name: "Imported Memories",
            projectType: "general",
            createdAt: now,
            updatedAt: now
          },
          ...nextProjects
        ];
        nextMemories = nextMemories.map((memory, index) => ({
          ...memory,
          projectId: memory.projectId ?? importedProjectId,
          order: typeof memory.order === "number" ? memory.order : index
        }));
      }

      const nextPhotos = data.photos ?? [];
      const nextSections = reconcilePageSections(nextMemories, nextPhotos, data.pageSections ?? []);

      setProjects(nextProjects);
      setMemories(nextMemories);
      setPhotos(nextPhotos);
      setPageSections(nextSections);
      setLoading(false);
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    const normalizedSections = reconcilePageSections(memories, photos, pageSections);
    void saveAppData({ projects, memories, pageSections: normalizedSections, photos }).catch(() => undefined);
  }, [loading, memories, pageSections, photos, projects]);

  const pickProjectThumbnail = useCallback(async (): Promise<string | undefined> => {
    const asset = await pickSingleImageFromLibrary();
    if (!asset) {
      return undefined;
    }
    const thumbId = makeId("thumb");
    return copyImageToAppStorage(asset.uri, thumbId, asset.fileName);
  }, []);

  const createProject = useCallback(
    async (name: string, projectType: ProjectType, thumbnailUri?: string): Promise<string> => {
      const now = new Date().toISOString();
      const project: Project = {
        id: makeId("project"),
        name: name.trim(),
        projectType,
        thumbnailUri,
        createdAt: now,
        updatedAt: now
      };
      setProjects((prev) => [project, ...prev]);
      return project.id;
    },
    []
  );

  const updateProject = useCallback(
    (projectId: string, updates: { name?: string; projectType?: ProjectType; thumbnailUri?: string }) => {
      const now = new Date().toISOString();
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                name: updates.name !== undefined ? updates.name.trim() : project.name,
                projectType: updates.projectType ?? project.projectType,
                thumbnailUri: updates.thumbnailUri !== undefined ? updates.thumbnailUri : project.thumbnailUri,
                updatedAt: now
              }
            : project
        )
      );
    },
    []
  );

  const deleteProject = useCallback((projectId: string) => {
    setProjects((prevProjects) => prevProjects.filter((project) => project.id !== projectId));
    setMemories((prevMemories) => {
      const removedMemoryIds = new Set(
        prevMemories.filter((memory) => memory.projectId === projectId).map((memory) => memory.id)
      );
      setPhotos((prevPhotos) => prevPhotos.filter((photo) => !removedMemoryIds.has(photo.memoryId)));
      setPageSections((prevSections) => prevSections.filter((section) => !removedMemoryIds.has(section.memoryId)));
      return prevMemories.filter((memory) => memory.projectId !== projectId);
    });
  }, []);

  const createMemory = useCallback(async (projectId: string, title: string, themeLabel?: string) => {
    const now = new Date().toISOString();
    let createdMemoryId = "";
    setMemories((prev) => {
      const nextOrder =
        prev
          .filter((memory) => memory.projectId === projectId)
          .reduce((maxOrder, memory) => Math.max(maxOrder, memory.order), -1) + 1;
      const memory: Memory = {
        id: makeId("memory"),
        projectId,
        title: title.trim(),
        themeLabel: themeLabel?.trim() || undefined,
        order: nextOrder,
        createdAt: now,
        updatedAt: now
      };
      createdMemoryId = memory.id;
      return [...prev, memory];
    });
    if (createdMemoryId) {
      setPageSections((prev) => [
        ...prev,
        {
          id: makeId("page"),
          memoryId: createdMemoryId,
          order: 0,
          templateId: undefined,
          backgroundColor: undefined,
          slotBorderColor: undefined,
          slotBorderWidth: undefined,
          slotCornerRadius: undefined,
          textColor: undefined,
          textSize: undefined,
          textWeight: undefined,
          textFontFamily: undefined,
          textBoxes: [],
          photoIds: [],
          heroPhotoId: undefined
        }
      ]);
    }
    setProjects((prev) =>
      prev.map((project) => (project.id === projectId ? { ...project, updatedAt: now } : project))
    );
    return createdMemoryId;
  }, []);

  const updateMemory = useCallback((memoryId: string, updates: { title?: string; themeLabel?: string }) => {
    const now = new Date().toISOString();
    let touchedProjectId = "";
    setMemories((prev) =>
      prev.map((memory) => {
        if (memory.id !== memoryId) {
          return memory;
        }
        touchedProjectId = memory.projectId;
        return {
          ...memory,
          title: updates.title !== undefined ? updates.title.trim() : memory.title,
          themeLabel: updates.themeLabel !== undefined ? updates.themeLabel.trim() || undefined : memory.themeLabel,
          updatedAt: now
        };
      })
    );
    if (touchedProjectId) {
      setProjects((prev) =>
        prev.map((project) => (project.id === touchedProjectId ? { ...project, updatedAt: now } : project))
      );
    }
  }, []);

  const deleteMemory = useCallback((memoryId: string) => {
    let touchedProjectId = "";
    setMemories((prev) =>
      prev.filter((memory) => {
        if (memory.id === memoryId) {
          touchedProjectId = memory.projectId;
          return false;
        }
        return true;
      })
    );
    setPhotos((prev) => prev.filter((photo) => photo.memoryId !== memoryId));
    setPageSections((prev) => prev.filter((section) => section.memoryId !== memoryId));
    if (touchedProjectId) {
      const now = new Date().toISOString();
      setProjects((prev) =>
        prev.map((project) => (project.id === touchedProjectId ? { ...project, updatedAt: now } : project))
      );
    }
  }, []);

  const moveMemory = useCallback((projectId: string, memoryId: string, direction: "up" | "down") => {
    const now = new Date().toISOString();
    setMemories((prev) => {
      const projectMemories = prev
        .filter((memory) => memory.projectId === projectId)
        .sort((a, b) => a.order - b.order);
      const index = projectMemories.findIndex((memory) => memory.id === memoryId);
      if (index === -1) {
        return prev;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= projectMemories.length) {
        return prev;
      }

      const reordered = [...projectMemories];
      const source = reordered[index];
      reordered[index] = reordered[targetIndex];
      reordered[targetIndex] = source;

      const rewritten = reordered.map((memory, idx) => ({
        ...memory,
        order: idx,
        updatedAt: memory.id === memoryId ? now : memory.updatedAt
      }));

      return prev.map((memory) => rewritten.find((item) => item.id === memory.id) ?? memory);
    });
    setProjects((prev) =>
      prev.map((project) => (project.id === projectId ? { ...project, updatedAt: now } : project))
    );
  }, []);

  const reorderMemory = useCallback((projectId: string, memoryId: string, toIndex: number) => {
    const now = new Date().toISOString();
    setMemories((prev) => {
      const projectMemories = prev
        .filter((memory) => memory.projectId === projectId)
        .sort((a, b) => a.order - b.order);
      const fromIndex = projectMemories.findIndex((memory) => memory.id === memoryId);
      if (fromIndex < 0) {
        return prev;
      }
      const boundedToIndex = Math.max(0, Math.min(toIndex, projectMemories.length - 1));
      if (fromIndex === boundedToIndex) {
        return prev;
      }

      const reordered = [...projectMemories];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(boundedToIndex, 0, moved);

      const rewritten = reordered.map((memory, idx) => ({
        ...memory,
        order: idx,
        updatedAt: memory.id === memoryId ? now : memory.updatedAt
      }));

      return prev.map((memory) => rewritten.find((item) => item.id === memory.id) ?? memory);
    });
    setProjects((prev) =>
      prev.map((project) => (project.id === projectId ? { ...project, updatedAt: now } : project))
    );
  }, []);

  const setMemoryPrimaryPhoto = useCallback(
    (memoryId: string, photoId: string) => {
      const photo = photos.find((item) => item.id === photoId);
      if (!photo || photo.memoryId !== memoryId) {
        return;
      }
      const now = new Date().toISOString();
      setMemories((prev) =>
        prev.map((memory) => (memory.id === memoryId ? { ...memory, primaryPhotoId: photoId, updatedAt: now } : memory))
      );
    },
    [photos]
  );

  const createPageSection = useCallback((memoryId: string) => {
    setPageSections((prev) => {
      const nextOrder = prev.filter((section) => section.memoryId === memoryId).length;
      return [
        ...prev,
        {
          id: makeId("page"),
          memoryId,
          order: nextOrder,
          templateId: undefined,
          backgroundColor: undefined,
          slotBorderColor: undefined,
          slotBorderWidth: undefined,
          slotCornerRadius: undefined,
          textColor: undefined,
          textSize: undefined,
          textWeight: undefined,
          textFontFamily: undefined,
          photoIds: [],
          heroPhotoId: undefined
        }
      ];
    });
  }, []);

  const deletePageSection = useCallback((pageSectionId: string, options?: { photoMode?: "merge" | "keep" | "discard" }) => {
    const photoMode = options?.photoMode ?? "merge";
    let discardedPhotoIds: string[] = [];
    let touchedMemoryId = "";

    setPageSections((prev) => {
      const target = prev.find((section) => section.id === pageSectionId);
      if (!target) {
        return prev;
      }
      touchedMemoryId = target.memoryId;
      const siblings = normalizeSectionOrder(prev.filter((section) => section.memoryId === target.memoryId));
      const targetIndex = siblings.findIndex((section) => section.id === pageSectionId);
      const remaining = siblings.filter((section) => section.id !== pageSectionId);

      if (remaining.length === 0) {
        const replacementPhotoIds = photoMode === "merge" ? target.photoIds : [];
        const replacementHeroPhotoId =
          photoMode === "merge" && target.heroPhotoId && replacementPhotoIds.includes(target.heroPhotoId)
            ? target.heroPhotoId
            : undefined;
        if (photoMode === "discard") {
          discardedPhotoIds = target.photoIds;
        }
        return [
          ...prev.filter((section) => section.memoryId !== target.memoryId),
          {
            id: makeId("page"),
            memoryId: target.memoryId,
            order: 0,
            photoIds: replacementPhotoIds,
            heroPhotoId: replacementHeroPhotoId,
            templateId: photoMode === "merge" ? target.templateId : undefined,
            backgroundColor: photoMode === "merge" ? target.backgroundColor : undefined,
            slotBorderColor: photoMode === "merge" ? target.slotBorderColor : undefined,
            slotBorderWidth: photoMode === "merge" ? target.slotBorderWidth : undefined,
            slotCornerRadius: photoMode === "merge" ? target.slotCornerRadius : undefined,
          textColor: photoMode === "merge" ? target.textColor : undefined,
          textSize: photoMode === "merge" ? target.textSize : undefined,
          textWeight: photoMode === "merge" ? target.textWeight : undefined,
          textFontFamily: photoMode === "merge" ? target.textFontFamily : undefined,
          textBoxes: []
        }
      ];
      }

      if (photoMode === "merge") {
        const fallbackIndex = targetIndex > 0 ? targetIndex - 1 : 0;
        const fallback = remaining[fallbackIndex];
        fallback.photoIds = [...fallback.photoIds, ...target.photoIds];
        if (!fallback.heroPhotoId && target.heroPhotoId && fallback.photoIds.includes(target.heroPhotoId)) {
          fallback.heroPhotoId = target.heroPhotoId;
        }
      } else if (photoMode === "discard") {
        discardedPhotoIds = target.photoIds;
      }

      const rebuilt = normalizeSectionOrder(remaining);
      return [...prev.filter((section) => section.memoryId !== target.memoryId), ...rebuilt];
    });

    if (photoMode === "discard" && discardedPhotoIds.length > 0) {
      const removed = new Set(discardedPhotoIds);
      const now = new Date().toISOString();
      setPhotos((prev) => prev.filter((photo) => !removed.has(photo.id)));
      setMemories((prev) =>
        prev.map((memory) => {
          if (memory.id !== touchedMemoryId || !memory.primaryPhotoId || !removed.has(memory.primaryPhotoId)) {
            return memory;
          }
          const remainingPhotos = sortByAddedAt(
            photos.filter((photo) => photo.memoryId === touchedMemoryId && !removed.has(photo.id))
          );
          return {
            ...memory,
            primaryPhotoId: remainingPhotos[0]?.id,
            updatedAt: now
          };
        })
      );
    }
  }, [photos]);

  const reorderPageSection = useCallback((memoryId: string, pageSectionId: string, toIndex: number) => {
    setPageSections((prev) => {
      const memorySections = normalizeSectionOrder(prev.filter((section) => section.memoryId === memoryId));
      const others = prev.filter((section) => section.memoryId !== memoryId);
      const fromIndex = memorySections.findIndex((section) => section.id === pageSectionId);
      if (fromIndex < 0) {
        return prev;
      }
      const boundedToIndex = Math.max(0, Math.min(toIndex, memorySections.length - 1));
      if (fromIndex === boundedToIndex) {
        return prev;
      }
      const reordered = [...memorySections];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(boundedToIndex, 0, moved);
      return [...others, ...normalizeSectionOrder(reordered)];
    });
  }, []);

  const movePhotoToPage = useCallback(
    (photoId: string, toPageSectionId: string, toIndex?: number) => {
      const photo = photos.find((item) => item.id === photoId);
      if (!photo) {
        return;
      }
      setPageSections((prev) => {
        const targetSection = prev.find((section) => section.id === toPageSectionId);
        if (!targetSection || targetSection.memoryId !== photo.memoryId) {
          return prev;
        }
        const sourceSection = prev.find(
          (section) => section.memoryId === photo.memoryId && section.photoIds.includes(photoId)
        );
        const sourceIndex = sourceSection?.photoIds.indexOf(photoId) ?? -1;
        return prev.map((section) => {
          if (section.memoryId !== photo.memoryId) {
            return section;
          }
          const isTarget = section.id === toPageSectionId;
          const filtered = section.photoIds.filter((id) => id !== photoId);
          let nextPhotoIds = filtered;
          if (isTarget) {
            let insertionIndex = typeof toIndex === "number" ? Math.max(0, Math.min(toIndex, filtered.length)) : filtered.length;
            if (sourceSection?.id === toPageSectionId && sourceIndex !== -1 && sourceIndex < insertionIndex) {
              insertionIndex -= 1;
            }
            nextPhotoIds = [...filtered];
            nextPhotoIds.splice(insertionIndex, 0, photoId);
          }
          return {
            ...section,
            photoIds: nextPhotoIds,
            heroPhotoId: section.heroPhotoId && nextPhotoIds.includes(section.heroPhotoId) ? section.heroPhotoId : undefined
          };
        });
      });
    },
    [photos]
  );

  const swapPhotos = useCallback(
    (sourcePhotoId: string, targetPhotoId: string) => {
      if (sourcePhotoId === targetPhotoId) {
        return;
      }
      const sourcePhoto = photos.find((item) => item.id === sourcePhotoId);
      const targetPhoto = photos.find((item) => item.id === targetPhotoId);
      if (!sourcePhoto || !targetPhoto || sourcePhoto.memoryId !== targetPhoto.memoryId) {
        return;
      }
      setPageSections((prev) => {
        const sourceSection = prev.find((section) => section.photoIds.includes(sourcePhotoId));
        const targetSection = prev.find((section) => section.photoIds.includes(targetPhotoId));
        if (!sourceSection || !targetSection) {
          return prev;
        }
        return prev.map((section) => {
          if (section.id !== sourceSection.id && section.id !== targetSection.id) {
            return section;
          }

          const nextPhotoIds = [...section.photoIds];
          if (sourceSection.id === targetSection.id) {
            const sourceIndex = nextPhotoIds.indexOf(sourcePhotoId);
            const targetIndex = nextPhotoIds.indexOf(targetPhotoId);
            if (sourceIndex >= 0 && targetIndex >= 0) {
              nextPhotoIds[sourceIndex] = targetPhotoId;
              nextPhotoIds[targetIndex] = sourcePhotoId;
            }
          } else if (section.id === sourceSection.id) {
            const sourceIndex = nextPhotoIds.indexOf(sourcePhotoId);
            if (sourceIndex >= 0) {
              nextPhotoIds[sourceIndex] = targetPhotoId;
            }
          } else if (section.id === targetSection.id) {
            const targetIndex = nextPhotoIds.indexOf(targetPhotoId);
            if (targetIndex >= 0) {
              nextPhotoIds[targetIndex] = sourcePhotoId;
            }
          }

          const nextHero =
            section.heroPhotoId === sourcePhotoId
              ? targetPhotoId
              : section.heroPhotoId === targetPhotoId
                ? sourcePhotoId
                : section.heroPhotoId;

          return {
            ...section,
            photoIds: nextPhotoIds,
            heroPhotoId: nextHero
          };
        });
      });
    },
    [photos]
  );

  const removePhotoFromPage = useCallback((photoId: string) => {
    setPageSections((prev) =>
      prev.map((section) => {
        if (!section.photoIds.includes(photoId)) {
          return section;
        }
        const nextPhotoIds = section.photoIds.filter((id) => id !== photoId);
        return {
          ...section,
          photoIds: nextPhotoIds,
          heroPhotoId: section.heroPhotoId === photoId ? undefined : section.heroPhotoId
        };
      })
    );
  }, []);

  const addPageTextBox = useCallback((pageSectionId: string, initial?: Partial<PageTextBox>) => {
    let createdId: string | undefined;
    setPageSections((prev) =>
      prev.map((section) => {
        if (section.id !== pageSectionId) {
          return section;
        }
        createdId = makeId("textbox");
        const textBox: PageTextBox = {
          id: createdId,
          text: initial?.text ?? "",
          x: initial?.x ?? 0.18,
          y: initial?.y ?? 0.12,
          width: initial?.width ?? 0.64,
          height: initial?.height ?? 0.16,
          textColor: initial?.textColor ?? "#0f172a",
          fontSize: initial?.fontSize ?? 26,
          fontWeight: initial?.fontWeight ?? "700",
          fontStyle: initial?.fontStyle ?? "normal",
          fontFamily: initial?.fontFamily ?? "System",
          textAlign: initial?.textAlign ?? "center",
          borderWidth: initial?.borderWidth ?? 0,
          borderColor: initial?.borderColor ?? "#0f172a",
          fillColor: initial?.fillColor ?? "#ffffff",
          fillOpacity: initial?.fillOpacity ?? 0,
          autoSize: initial?.autoSize ?? true
        };
        return {
          ...section,
          textBoxes: [...(section.textBoxes ?? []), textBox]
        };
      })
    );
    return createdId;
  }, []);

  const updatePageTextBox = useCallback((pageSectionId: string, textBoxId: string, updates: Partial<PageTextBox>) => {
    setPageSections((prev) =>
      prev.map((section) =>
        section.id === pageSectionId
          ? {
              ...section,
              textBoxes: (section.textBoxes ?? []).map((textBox) =>
                textBox.id === textBoxId ? { ...textBox, ...updates } : textBox
              )
            }
          : section
      )
    );
  }, []);

  const deletePageTextBox = useCallback((pageSectionId: string, textBoxId: string) => {
    setPageSections((prev) =>
      prev.map((section) =>
        section.id === pageSectionId
          ? {
              ...section,
              textBoxes: (section.textBoxes ?? []).filter((textBox) => textBox.id !== textBoxId)
            }
          : section
      )
    );
  }, []);

  const setPageHero = useCallback(
    (pageSectionId: string, photoId: string) => {
      setPageSections((prev) =>
        prev.map((section) =>
          section.id === pageSectionId && section.photoIds.includes(photoId)
            ? { ...section, heroPhotoId: photoId }
            : section
        )
      );
    },
    []
  );

  const setPageSectionTemplate = useCallback((pageSectionId: string, templateId?: string) => {
    setPageSections((prev) =>
      prev.map((section) =>
        section.id === pageSectionId
          ? {
              ...section,
              templateId
            }
          : section
      )
    );
  }, []);

  const updatePageSectionStyle = useCallback(
    (
      pageSectionId: string,
      updates: Partial<
        Pick<
          MemoryPageSection,
          | "backgroundColor"
          | "slotBorderColor"
          | "slotBorderWidth"
          | "slotCornerRadius"
          | "textColor"
          | "textSize"
          | "textWeight"
          | "textFontFamily"
        >
      >
    ) => {
      setPageSections((prev) =>
        prev.map((section) => (section.id === pageSectionId ? { ...section, ...updates } : section))
      );
    },
    []
  );

  const addPhotoAssetsToMemory = useCallback(
    async (
      memoryId: string,
      selected: { uri: string; fileName?: string | null; width?: number; height?: number }[]
    ): Promise<string[]> => {
      if (selected.length === 0) {
        return [];
      }
      const location = await getCurrentLocation();
      const createdPhotos: PhotoItem[] = [];
      const createdPhotoIds: string[] = [];
      const now = new Date().toISOString();

      for (const asset of selected) {
        const photoId = makeId("photo");
        const localUri = await copyImageToAppStorage(asset.uri, photoId, asset.fileName);
        createdPhotoIds.push(photoId);
        createdPhotos.push({
          id: photoId,
          memoryId,
          uri: localUri,
          width: asset.width,
          height: asset.height,
          capturedAt: now,
          addedAt: now,
          location
        });
      }

      setPhotos((prev) => [...createdPhotos, ...prev]);

      setPageSections((prev) => {
        const memorySections = normalizeSectionOrder(prev.filter((section) => section.memoryId === memoryId));
        const others = prev.filter((section) => section.memoryId !== memoryId);
        const sections = memorySections.length > 0
          ? [...memorySections]
          : [
              {
                id: makeId("page"),
                memoryId,
                order: 0,
                templateId: undefined,
                backgroundColor: undefined,
                slotBorderColor: undefined,
                slotBorderWidth: undefined,
                slotCornerRadius: undefined,
                textColor: undefined,
                textSize: undefined,
                textWeight: undefined,
                textFontFamily: undefined,
                textBoxes: [],
                photoIds: [],
                heroPhotoId: undefined
              }
            ];

        return [...others, ...normalizeSectionOrder(sections)];
      });

      let touchedProjectId = "";
      setMemories((prev) =>
        prev.map((memory) => {
          if (memory.id !== memoryId) {
            return memory;
          }
          touchedProjectId = memory.projectId;
          return {
            ...memory,
            primaryPhotoId: memory.primaryPhotoId ?? createdPhotos[0]?.id,
            updatedAt: now
          };
        })
      );
      if (touchedProjectId) {
        setProjects((prev) =>
          prev.map((project) => (project.id === touchedProjectId ? { ...project, updatedAt: now } : project))
        );
      }

      return createdPhotoIds;
    },
    []
  );

  const addPhotosToMemory = useCallback(
    async (memoryId: string): Promise<number> => {
      const selected = await pickImagesFromLibrary();
      if (selected.length === 0) {
        return 0;
      }
      const createdPhotoIds = await addPhotoAssetsToMemory(memoryId, selected);
      return createdPhotoIds.length;
    },
    [addPhotoAssetsToMemory]
  );

  const deletePhotos = useCallback((photoIds: string[]) => {
    if (photoIds.length === 0) {
      return;
    }
    const removed = new Set(photoIds);
    const now = new Date().toISOString();
    const remainingByMemory = new Map<string, PhotoItem[]>();

    setPhotos((prev) => {
      const next = prev.filter((photo) => !removed.has(photo.id));
      for (const photo of next) {
        const list = remainingByMemory.get(photo.memoryId) ?? [];
        list.push(photo);
        remainingByMemory.set(photo.memoryId, list);
      }
      return next;
    });

    setPageSections((prev) =>
      prev.map((section) => {
        const nextPhotoIds = section.photoIds.filter((id) => !removed.has(id));
        return {
          ...section,
          photoIds: nextPhotoIds,
          heroPhotoId: section.heroPhotoId && nextPhotoIds.includes(section.heroPhotoId) ? section.heroPhotoId : undefined
        };
      })
    );

    setMemories((prev) =>
      prev.map((memory) => {
        if (!memory.primaryPhotoId || !removed.has(memory.primaryPhotoId)) {
          return memory;
        }
        const replacement = sortByAddedAt(remainingByMemory.get(memory.id) ?? [])[0];
        return {
          ...memory,
          primaryPhotoId: replacement?.id,
          updatedAt: now
        };
      })
    );
  }, []);

  const getProjectById = useCallback(
    (id: string) => {
      return projects.find((project) => project.id === id);
    },
    [projects]
  );

  const getMemoriesByProjectId = useCallback(
    (projectId: string) => {
      return memories.filter((memory) => memory.projectId === projectId).sort((a, b) => a.order - b.order);
    },
    [memories]
  );

  const getMemoryById = useCallback(
    (id: string) => {
      return memories.find((memory) => memory.id === id);
    },
    [memories]
  );

  const getPhotosByMemoryId = useCallback(
    (memoryId: string) => {
      return photos.filter((photo) => photo.memoryId === memoryId).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    },
    [photos]
  );

  const getPageSectionsByMemoryId = useCallback(
    (memoryId: string) => {
      return normalizeSectionOrder(pageSections.filter((section) => section.memoryId === memoryId));
    },
    [pageSections]
  );

  const getMemoryThumbnailUri = useCallback(
    (memoryId: string) => {
      const memory = memories.find((item) => item.id === memoryId);
      if (!memory) {
        return undefined;
      }
      const memoryPhotos = sortByAddedAt(photos.filter((photo) => photo.memoryId === memoryId));
      const sections = normalizeSectionOrder(pageSections.filter((section) => section.memoryId === memoryId));
      const firstHero = sections.find((section) => section.heroPhotoId)?.heroPhotoId;
      const candidateId = firstHero ?? memory.primaryPhotoId ?? sections.find((section) => section.photoIds.length > 0)?.photoIds[0];
      if (candidateId) {
        const photo = memoryPhotos.find((item) => item.id === candidateId);
        if (photo) {
          return photo.uri;
        }
      }
      return memoryPhotos[0]?.uri;
    },
    [memories, pageSections, photos]
  );

  const value = useMemo(
    () => ({
      loading,
      projects,
      memories,
      pageSections,
      photos,
      pickProjectThumbnail,
      createProject,
      updateProject,
      deleteProject,
      getProjectById,
      createMemory,
      updateMemory,
      deleteMemory,
      moveMemory,
      reorderMemory,
      setMemoryPrimaryPhoto,
      addPhotosToMemory,
      addPhotoAssetsToMemory,
      deletePhotos,
      createPageSection,
      deletePageSection,
      reorderPageSection,
      movePhotoToPage,
      removePhotoFromPage,
      swapPhotos,
      addPageTextBox,
      updatePageTextBox,
      deletePageTextBox,
      setPageHero,
      setPageSectionTemplate,
      updatePageSectionStyle,
      getMemoriesByProjectId,
      getMemoryById,
      getPhotosByMemoryId,
      getPageSectionsByMemoryId,
      getMemoryThumbnailUri
    }),
    [
      addPhotoAssetsToMemory,
      addPhotosToMemory,
      createMemory,
      createPageSection,
      createProject,
      deleteMemory,
      deletePageSection,
      deletePhotos,
      deleteProject,
      getMemoriesByProjectId,
      getMemoryById,
      getMemoryThumbnailUri,
      getPageSectionsByMemoryId,
      getPhotosByMemoryId,
      getProjectById,
      loading,
      memories,
      moveMemory,
      reorderMemory,
      reorderPageSection,
      movePhotoToPage,
      removePhotoFromPage,
      swapPhotos,
      addPageTextBox,
      updatePageTextBox,
      deletePageTextBox,
      pageSections,
      photos,
      pickProjectThumbnail,
      projects,
      setMemoryPrimaryPhoto,
      setPageHero,
      setPageSectionTemplate,
      updatePageSectionStyle,
      updateMemory,
      updateProject
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppProvider.");
  }
  return ctx;
}
