# Design library

Design content the app offers lives here, one folder per pack. You add a pack by adding a folder; you don't need to edit code.

```
library/
  backgrounds/
    <pack-id>/
      manifest.json        # pack metadata and its backgrounds
      assets/*.svg         # files referenced by each background's "asset"
      previews/, art-direction-plan.json   # optional, not bundled into the app
```

## Adding a background pack

1. Create `library/backgrounds/<pack-id>/` and give it a `manifest.json` whose `id` matches the folder name.
2. Put the SVG files in the folder and point each background's `asset` at them, for example `"assets/<pack-id>-01.svg"`.
3. Run `npm run library`. It also runs automatically before `npm start`, `npm run android`, `npm test` and EAS builds.

`scripts/build-library.cjs` validates every pack and writes `src/library/generated.ts`. Commit that file along with the pack.

If a pack is broken, the script stops and names the pack, the background and the problem, for example `asset file "assets/x.svg" not found` or a duplicate id.

### Manifest fields

| Field | Required | Notes |
|---|---|---|
| `id`, `label` | yes | `id` must match the folder name |
| `order` | no | Pack position in pickers. Packs without it come after, alphabetically. |
| `backgrounds[]` | yes | Each needs `number`, `id` (lowercase-kebab, unique across all packs), `label`, `theme`, `kind` (`solid`, `gradient`, `pattern`, `illustration`, `photo-texture`), `backgroundColor`, `palette`, `tags`, `textColor` and `safeArea` (0–1 fractions of the page). `asset` and `slotBorderColor` are optional. |
| `retired` (per background) | no | Hides the background from pickers. Saved pages that use it keep rendering. |

Other fields, such as `pageFormat` and `assetSize`, are allowed and ignored.

## Rules

- **Never delete or rename a background id that has shipped.** Saved pages refer to it by id. Set `"retired": true` instead.
- The app reads packs only through `src/library/backgrounds.ts`. Nothing should import pack files directly.
