export type ProjectType =
  | "yearbook"
  | "baby-book"
  | "wedding-album"
  | "year-in-review"
  | "vacation"
  | "general";

export type ProjectTimelineMode = "ongoing" | "past" | "hybrid";
export type ProjectAssistLevel = "quiet" | "balanced" | "proactive";
export type ProjectStyleIntensity = "minimal" | "warm" | "playful" | "expressive";

export type Project = {
  id: string;
  name: string;
  projectType: ProjectType;
  timelineMode: ProjectTimelineMode;
  includeFutureProjectPhotos: boolean;
  startDate?: string;
  endDate?: string;
  assistLevel: ProjectAssistLevel;
  styleIntensity: ProjectStyleIntensity;
  thumbnailUri?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryKind = "event" | "collection" | "hybrid";
export type MemoryStatus = "suggested" | "watching" | "active" | "finalized" | "archived";

export type Memory = {
  id: string;
  projectId: string;
  title: string;
  kind: MemoryKind;
  status: MemoryStatus;
  themeLabel?: string;
  themeTags?: string[];
  primaryPhotoId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type TextBoxAlignment = "left" | "center" | "right";

export type PageTextBox = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  fontFamily?: string;
  textAlign?: TextBoxAlignment;
  borderWidth?: number;
  borderColor?: string;
  fillColor?: string;
  fillOpacity?: number;
  autoSize?: boolean;
};

export type MemoryPageSection = {
  id: string;
  memoryId: string;
  order: number;
  heroPhotoId?: string;
  templateId?: string;
  backgroundColor?: string;
  slotBorderColor?: string;
  slotBorderWidth?: number;
  slotCornerRadius?: number;
  textColor?: string;
  textSize?: number;
  textWeight?: string;
  textFontFamily?: string;
  textBoxes?: PageTextBox[];
  photoIds: string[];
};

export type PhotoItem = {
  id: string;
  projectId: string;
  memoryId?: string;
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

export type SuggestionType = "event" | "collection";
export type SuggestionStatus = "new" | "watching" | "snoozed" | "dismissed" | "accepted";

export type Suggestion = {
  id: string;
  projectId: string;
  type: SuggestionType;
  status: SuggestionStatus;
  title: string;
  message: string;
  candidatePhotoIds: string[];
  acceptedMemoryId?: string;
  createdAt: string;
};

export type AppData = {
  projects: Project[];
  memories: Memory[];
  pageSections: MemoryPageSection[];
  photos: PhotoItem[];
  suggestions: Suggestion[];
};
