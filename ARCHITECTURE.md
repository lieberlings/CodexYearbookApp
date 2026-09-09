# MVP Architecture Note — Memory-First Reset

## Current architectural direction
The app is being reset toward a simpler MVP architecture.

The user-visible model should be memory-first:
- Project
- Memory
- Suggested Memory
- Theme Page
- Finalization

Project-level photo pools, image-analysis inspectors, and cluster inspectors should not be part of the normal user experience.

## Current implementation snapshot
As of 2026-09-02, the codebase already contains the core infrastructure for this direction:
- Expo Router project and memory screens
- memory/page editor with layout, text, background, and export support
- `SuggestionCandidatePhotoRef` records for temporary MediaLibrary-backed suggestion candidates
- MediaLibrary suggestion scanning through `scanMediaLibrarySuggestionsForProject`
- suggestion lifecycle persistence for new, watching, snoozed, dismissed, and accepted states
- Android Photo Picker support for explicit user-selected memory/theme imports
- dev-only analysis, probe, and cluster tools guarded by `__DEV__`

The remaining architecture work is mainly to complete the user-reviewed import path from accepted suggestion candidates into memory photos, add scan cadence fields, and keep theme/finalization flows aligned with accepted content only.

## User-visible data flow

### Suggested memories
Suggested memories come from scanning on-device media-library metadata within the project scope.

Flow:
1. project defines date range / ongoing settings
2. scan reads local media-library asset metadata
3. app creates SuggestedMemory candidates
4. candidates contain temporary `SuggestionCandidatePhotoRef` records
5. user accepts/rejects/snoozes
6. accepted selected candidate photos are imported into a normal Memory
7. rejected candidate refs are discarded

Accepting a suggestion must not bulk-import every candidate by default. The user should be able to review candidates, choose the photos to keep, and then import those selections as normal `PhotoItem` records linked to the created memory.

### Theme pages
Theme pages are user-led.

Flow:
1. user chooses a suggested theme or custom search term
2. app opens a picker/search flow; on Android, manual selection should prefer Photo Picker search highlighting where available
3. user selects photos
4. app creates a theme page or adds to existing theme
5. selected photos are imported as accepted photos

Manual memory and theme photo selection optimizes for user search/discovery. Android Photo Picker results may be imported as picker-fallback photos without canonical MediaStore asset ids or GPS metadata.

## Important technical distinction

### CandidatePhotoRef
A temporary reference to a source media-library or picker asset.

It may contain:
- source asset id
- uri or thumbnail reference
- capturedAt
- location
- dimensions
- quality summary

It is not a project photo and should not be counted as accepted content.

For library-backed suggested memory scans, `SuggestionCandidatePhotoRef` should prefer canonical MediaLibrary/MediaStore asset ids and metadata because scan quality depends on timestamps and GPS/location clusters. For manual Photo Picker selections, canonical ids and GPS metadata are best-effort only and should not be required.

### PhotoItem
A photo imported into the app because the user accepted/selected it.

For MVP, PhotoItem should belong to:
- a memory
- or an accepted theme page

Unassigned/project-level `PhotoItem` records may remain for migration, internal compatibility, and dev-only workflows, but the normal product should not present a project photo pool as the user's organizing model.

## Dev-only systems
The following systems may remain in the codebase but should be hidden from normal UX:
- single-image analysis inspector
- cluster inspector
- media-library probe UI
- raw ML Kit label/face debug panels
- project photo pool UI

## Preserved infrastructure
The following work remains valuable:
- canonical media resolver
- Android Media Library GPS preservation for library-backed suggestion scanning
- photo metadata normalization
- image analysis service boundaries
- ML Kit experiments
- project cluster engine as internal/debug infrastructure

These should not drive the MVP user flow directly.

## MVP scan model
For MVP, suggested memory scanning is:
- on-device only
- project-scoped
- date/time/location driven
- review-based
- non-importing until accepted

Repeated scans should preserve explicit user choices. A scan may refresh candidate metadata for an existing suggestion, but it should not downgrade accepted suggestions, resurrect dismissed candidates into the normal queue, or lose snoozed/watching state.

## Cloud and cross-platform model
Cloud photos are roadmap/future unless explicitly user-selected through supported picker flows.

Future platform-specific implementations should fit behind existing resolver/import seams:
- Android: Media Library for metadata-rich library scans; Photo Picker / Embedded Photo Picker for explicit user selection and search-highlight UX
- iOS: Photos picker/photo-library equivalent
- Web: upload/browser metadata flow
