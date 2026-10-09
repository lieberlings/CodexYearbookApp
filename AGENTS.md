# AGENTS.md

## Project

YearBook App is an Android-first React Native + Expo app for capturing memories and exporting simple photobooks.

The repository root is `C:\Users\Lieber\Documents\YearBookApp\CodexYearbookApp`.

## Commands

- Install dependencies: `npm install`
- Start Expo: `npm run start`
- Run Android app: `npm run android`
- Lint: `npm run lint`
- Test: `npm test`
- Type check: `npm exec tsc -- --noEmit`
- Android Kotlin compile: from `android`, run `.\gradlew.bat :app:compileDebugKotlin --console=plain --no-daemon`

## Architecture Direction

- Keep the MVP memory-first: Project, Memory, Suggested Memory, Theme Page, Finalization.
- Do not make project-level photo pools, image-analysis inspectors, cluster inspectors, media-library probes, raw ML Kit debug panels, or similar dev tools part of the normal user experience.
- Suggested memories should be on-device, project-scoped, date/time/location driven, review-based, and non-importing until the user accepts and selects photos.
- Treat `SuggestionCandidatePhotoRef` as a temporary MediaLibrary-backed source reference for suggested memories.
- Treat Android Photo Picker results as explicit user-selected imports. They may become `PhotoItem`s, but they should not be used as the source of truth for GPS/location clustering.
- Treat `PhotoItem` as an imported app photo. In the normal MVP path it should belong to a memory or accepted theme page; project-level/unassigned photos may remain as legacy/internal compatibility but should not be surfaced as a product concept.
- Preserve useful internal infrastructure, including canonical media resolution, Android Media Library metadata preservation, metadata normalization, image-analysis service boundaries, ML Kit experiments, prompt/finalization engines, and cluster-engine experiments, but keep them behind the MVP flow unless promoted deliberately.

## Current Implementation Notes

- `scanMediaLibrarySuggestionsForProject` exists and produces event suggestions from temporary MediaLibrary candidate refs.
- Suggestion status is persisted and repeated scans should preserve accepted, dismissed, snoozed, and watching state.
- Accepting a suggestion currently creates/links a memory first; importing only the user-selected candidate photos is the remaining product-critical step.
- Theme pages are currently represented through collection memories with `themeLabel`/`themeTags`; a separate `ThemePage` entity should not be introduced unless the product workflow needs it.
- `DEV_TOOLS_ENABLED` / `__DEV__` is the expected boundary for analysis inspectors, cluster displays, and probe tools.

## Android Notes

- Android is the first target platform.
- For metadata-rich scans, prefer Media Library / MediaStore-backed flows where available.
- For explicit manual selection, prefer Android Photo Picker / Embedded Photo Picker behavior where it fits the UX.
- Picker fallback photos may not have canonical MediaStore asset ids or GPS metadata; do not require those fields for manual picker imports.
- Do not gate manual memory or theme imports on `ACCESS_MEDIA_LOCATION`, canonical asset ids, or unredacted EXIF availability.

## Design Library

- Backgrounds live in `library/backgrounds/<pack>/manifest.json` and are discovered by `scripts/build-library.cjs`, which writes `src/library/generated.ts` (do not edit it by hand). See `library/README.md`.
- Read packs through `src/library/backgrounds.ts`; never import pack files directly or keep hand-written asset lists.
- Retire shipped background ids with `"retired": true` instead of deleting or renaming them.

## Working Agreements

- Prefer small, focused changes that match the existing Expo Router and service/context layout.
- Do not edit generated files or native build outputs.
- Ask before adding new production dependencies.
- Keep secrets, keystores, signing config, API keys, and local-only SDK config out of the repo.
- When changing behavior, run the narrowest relevant verification command and report anything that could not be run.
- For doc-only changes, at minimum review the edited files and run `git diff --check` when available.
