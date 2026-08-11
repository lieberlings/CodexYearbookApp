# Layout Template Packs

Reusable templates can be added as separate modules in this folder.

## Add A Pack

1. Create a file like `schoolPortraits.ts`.
2. Export a `TemplatePack`.
3. Add it to `templatePacks` in `index.ts`.

```ts
import { TemplatePack } from "../templateTypes";

export const schoolPortraitsTemplatePack: TemplatePack = {
  id: "school-portraits",
  label: "School Portraits",
  templates: [
    {
      id: "school-portraits-4-grid",
      label: "Portrait Grid",
      photoCount: 4,
      baseScore: 24,
      slots: [
        {
          id: "slot-1",
          role: "photo",
          fitMode: "cover",
          priority: 1,
          preferredOrientation: "portrait",
          frame: { x: 0.06, y: 0.06, width: 0.42, height: 0.42 }
        }
      ]
    }
  ]
};
```

## Figma Export Shape

For each top-level Figma frame, export the frame bounds and its fillable grey rectangles. Convert each rectangle to normalized page coordinates:

```ts
x = (slotLeft - frameLeft) / frameWidth;
y = (slotTop - frameTop) / frameHeight;
width = slotWidth / frameWidth;
height = slotHeight / frameHeight;
```

Use layer names to decide slot type:

- `photo:hero` or `photo:1` becomes a photo slot.
- `text:title` should become a page text box when template-level text placeholders are added.

The current reusable template catalog supports photo slots. Page text boxes already exist in saved pages, but template-level text placeholders are the next integration step.
