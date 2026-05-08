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

## User-visible data flow

### Suggested memories
Suggested memories come from scanning on-device media-library metadata within the project scope.

Flow:
1. project defines date range / ongoing settings
2. scan reads local media-library asset metadata
3. app creates SuggestedMemory candidates
4. candidates contain temporary CandidatePhotoRefs
5. user accepts/rejects/snoozes
6. accepted selected photos are imported into a normal Memory
7. rejected candidate refs are discarded

### Theme pages
Theme pages are user-led.

Flow:
1. user chooses a suggested theme or custom search term
2. app opens picker/search flow
3. user selects photos
4. app creates a theme page or adds to existing theme
5. selected photos are imported as accepted photos

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

It is not a project photo.

### PhotoItem
A photo imported into the app because the user accepted/selected it.

For MVP, PhotoItem should belong to:
- a memory
- or an accepted theme page

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
- Android Media Library GPS preservation
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

## Cloud and cross-platform model
Cloud photos are roadmap/future unless explicitly user-selected through supported picker flows.

Future platform-specific implementations should fit behind existing resolver/import seams:
- Android: Media Library / Photo Picker / Embedded Photo Picker
- iOS: Photos picker/photo-library equivalent
- Web: upload/browser metadata flow