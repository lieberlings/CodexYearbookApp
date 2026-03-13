import { z } from "zod";

export const SlotRoleSchema = z.enum(["hero", "photo"]);
export const SlotFitModeSchema = z.enum(["contain", "cover"]);

export const SlotFrameSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1)
});

export const LayoutSlotSchema = z.object({
  id: z.string(),
  role: SlotRoleSchema,
  fitMode: SlotFitModeSchema,
  photoScale: z.number().min(0.5).max(3).default(1),
  photoOffsetX: z.number().min(-1).max(1).default(0),
  photoOffsetY: z.number().min(-1).max(1).default(0),
  frame: SlotFrameSchema,
  photoId: z.string().optional()
});

export const LayoutPageSchema = z.object({
  id: z.string(),
  memoryId: z.string(),
  memoryTitle: z.string(),
  themeLabel: z.string().optional(),
  backgroundColor: z.string().optional(),
  slotBorderColor: z.string().optional(),
  slotBorderWidth: z.number().min(0).max(24).optional(),
  slotCornerRadius: z.number().min(0).max(48).optional(),
  textColor: z.string().optional(),
  textSize: z.number().min(8).max(48).optional(),
  textWeight: z.string().optional(),
  textFontFamily: z.string().optional(),
  pageIndex: z.number().int().min(0),
  pageCount: z.number().int().min(1),
  templateId: z.string(),
  slots: z.array(LayoutSlotSchema)
});

export const LayoutDocumentSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  orientation: z.enum(["landscape", "portrait"]),
  pages: z.array(LayoutPageSchema)
});

export type LayoutSlot = z.infer<typeof LayoutSlotSchema>;
export type LayoutPage = z.infer<typeof LayoutPageSchema>;
export type LayoutDocument = z.infer<typeof LayoutDocumentSchema>;
