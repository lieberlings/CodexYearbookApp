# Design library

Design content the app offers lives here, one folder per pack. You add a pack by adding a folder; you don't need to edit code.

```
library/
  backgrounds/
    <pack-id>/
      manifest.json        # pack metadata and its backgrounds
      assets/*.svg         # files referenced by each background's "asset"
      previews/, art-direction-plan.json   # optional, not bundled into the app
  layouts/
    <pack-id>/
      manifest.json        # pack metadata and its page layout templates
  shapes/
    <pack-id>/
      manifest.json        # pack metadata and its object shapes
```

Run `npm run library` after any change. It also runs automatically before `npm start`, `npm run android`, `npm test` and EAS builds.

`scripts/build-library.cjs` validates every pack and writes `src/library/generated.ts`. Commit that file along with the pack, and never edit it by hand.

If a pack is broken, the script stops and names the pack, the item and the problem, for example `asset file "assets/x.svg" not found`, `photoCount 2 must match the 1 slots` or a duplicate id.

Every manifest has the same top-level fields:

| Field | Required | Notes |
|---|---|---|
| `id`, `label` | yes | `id` must match the folder name |
| `order` | no | Pack position. Packs without it come after, alphabetically. |

Item ids are lowercase-kebab-case and must be unique across all packs of the same kind. Any item can carry `"retired": true` (see [Rules](#rules)).

## Adding a background pack

1. Create `library/backgrounds/<pack-id>/` and give it a `manifest.json` whose `id` matches the folder name.
2. Put the SVG files in the folder and point each background's `asset` at them, for example `"assets/<pack-id>-01.svg"`.
3. Run `npm run library`.

The app reads background packs only through `src/library/backgrounds.ts`.

| Field | Required | Notes |
|---|---|---|
| `backgrounds[]` | yes | Each needs `number`, `id`, `label`, `theme`, `kind` (`solid`, `gradient`, `pattern`, `illustration`, `photo-texture`), `backgroundColor`, `palette`, `tags`, `textColor` and `safeArea` (0–1 fractions of the page). `asset` and `slotBorderColor` are optional. |
| `retired` (per background) | no | Hides the background from pickers. Saved pages that use it keep rendering. |

Other fields, such as `pageFormat` and `assetSize`, are allowed and ignored.

## Adding a layout pack

A layout is a page template: a set of photo slots placed on the page.

1. Create `library/layouts/<pack-id>/manifest.json` whose `id` matches the folder name.
2. List the templates under `templates`.
3. Run `npm run library`.

The app reads layout packs only through `src/library/layouts.ts`; `src/layout/templates.ts` builds the template catalog from them.

| Field | Required | Notes |
|---|---|---|
| `templates[]` | yes | Each needs `id`, `label`, `photoCount`, `baseScore` and `slots`. `photoCount` must equal the number of slots. |
| `slots[]` (per template) | yes | Each needs `id` (unique within the template), `role` (`hero` or `photo`), `fitMode` (`cover` or `contain`), `priority` (lower fills first), `preferredOrientation` (`portrait`, `landscape`, `square`, `any`) and `frame` (`x`, `y`, `width`, `height` as 0–1 fractions of the page). |
| `retired` (per template) | no | Hides the template from the layout picker and automatic selection. Saved pages that use it keep rendering. |

```json
{
  "id": "school-portraits",
  "label": "School Portraits",
  "templates": [
    {
      "id": "school-portraits-01",
      "label": "Portrait Pair",
      "photoCount": 2,
      "baseScore": 24,
      "slots": [
        { "id": "slot-1", "role": "photo", "fitMode": "cover", "priority": 1, "preferredOrientation": "portrait", "frame": { "x": 0.06, "y": 0.06, "width": 0.42, "height": 0.88 } },
        { "id": "slot-2", "role": "photo", "fitMode": "cover", "priority": 2, "preferredOrientation": "portrait", "frame": { "x": 0.52, "y": 0.06, "width": 0.42, "height": 0.88 } }
      ]
    }
  ]
}
```

### From a Figma frame

For each top-level Figma frame, export the frame bounds and its fillable grey rectangles. Convert each rectangle to page fractions:

```
x = (slotLeft - frameLeft) / frameWidth
y = (slotTop - frameTop) / frameHeight
width = slotWidth / frameWidth
height = slotHeight / frameHeight
```

Use layer names to decide the slot type: `photo:hero` becomes a `hero` slot and `photo:1`, `photo:2`, … become `photo` slots. Templates hold photo slots only for now; template-level text placeholders (for example a `text:title` layer) are a later step.

## Adding a shape pack

Shapes are the outlines photo slots and text boxes can take (circle, heart, star, …).

1. Create `library/shapes/<pack-id>/manifest.json` whose `id` matches the folder name.
2. List the shapes under `shapes`.
3. Run `npm run library`.

The app reads shape packs only through `src/library/shapes.ts`; `src/layout/objectShapes.ts` exposes them to the rest of the app. The generator also writes the shape ids into `generated.ts` so the `ObjectShape` type stays a list of the real ids.

| Field | Required | Notes |
|---|---|---|
| `shapes[]` | yes | Each needs `id`, `label`, `path` (a non-empty SVG path on a 100 × 100 canvas) and `textBounds` (`x`, `y`, `width`, `height` as 0–1 fractions: the area inside the shape where text fits). |
| `retired` (per shape) | no | Hides the shape from pickers. Saved pages that use it keep rendering. |

A shape with id `rectangle` must exist in some pack: saved pages whose shape id is unknown fall back to it.

## Rules

- **Never delete or rename an id that has shipped**, whether it is a background, a layout template or a shape. Saved pages refer to it by id. Set `"retired": true` instead.
- The app reads packs only through `src/library/backgrounds.ts`, `src/library/layouts.ts` and `src/library/shapes.ts`. Nothing should import pack files directly or keep a hand-written list of them.
