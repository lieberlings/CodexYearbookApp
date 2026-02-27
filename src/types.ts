export type ProjectType =
  | "baby-book"
  | "wedding-album"
  | "year-in-review"
  | "vacation"
  | "general";

export type Project = {
  id: string;
  name: string;
  projectType: ProjectType;
  thumbnailUri?: string;
  createdAt: string;
  updatedAt: string;
};

export type Memory = {
  id: string;
  projectId: string;
  title: string;
  themeLabel?: string;
  primaryPhotoId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryPageSection = {
  id: string;
  memoryId: string;
  order: number;
  heroPhotoId?: string;
  photoIds: string[];
};

export type PhotoItem = {
  id: string;
  memoryId: string;
  uri: string;
  exportDataUri?: string;
  width?: number;
  height?: number;
  capturedAt: string;
  addedAt: string;
  location?: {
    latitude: number;
    longitude: number;
  };
};

export type PromptType = "time-interval" | "photo-spike" | "location-pattern";

export type PromptItem = {
  id: string;
  type: PromptType;
  title: string;
  message: string;
  memoryId?: string;
};

export type AppData = {
  projects: Project[];
  memories: Memory[];
  pageSections: MemoryPageSection[];
  photos: PhotoItem[];
};
