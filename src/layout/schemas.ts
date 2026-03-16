import { z } from "zod";

export const SlotRoleSchema = z.enum(["hero", "photo"]);
export const SlotFitModeSchema = z.enum(["contain", "cover"]);
export const TextBoxAlignmentSchema = z.enum(["left", "center", "right"]);

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

export const PageTextBoxSchema = z.object({
  id: z.string(),
  text: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.05).max(1),
  height: z.number().min(0.05).max(1),
  textColor: z.string().optional(),
  fontSize: z.number().min(8).max(72).optional(),
  fontWeight: z.string().optional(),
  fontStyle: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: TextBoxAlignmentSchema.optional(),
  borderWidth: z.number().min(0).max(24).optional(),
  borderColor: z.string().optional(),
  fillColor: z.string().optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  autoSize: z.boolean().optional()
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
  textBoxes: z.array(PageTextBoxSchema).default([]),
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
export type PageTextBox = z.infer<typeof PageTextBoxSchema>;
export type LayoutPage = z.infer<typeof LayoutPageSchema>;
export type LayoutDocument = z.infer<typeof LayoutDocumentSchema>;
