export type PhotoOrientation = "portrait" | "landscape" | "square";
export type SlotOrientationPreference = PhotoOrientation | "any";

export type TemplateSlotBlueprint = {
  id: string;
  role: "hero" | "photo";
  frame: { x: number; y: number; width: number; height: number };
  fitMode: "contain" | "cover";
  priority: number;
  preferredOrientation: SlotOrientationPreference;
};

export type TemplateDefinition = {
  id: string;
  label: string;
  photoCount: number;
  baseScore: number;
  slots: TemplateSlotBlueprint[];
  // Hidden from pickers and automatic selection; saved pages still resolve it by id.
  retired?: boolean;
};

export type TemplatePack = {
  id: string;
  label: string;
  templates: TemplateDefinition[];
};
