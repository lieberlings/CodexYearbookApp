# Current Engineering Roadmap — MVP Reset

## Why the roadmap changed
The app has working prototypes for project photo pools, image analysis, native ML Kit, cluster inspection, and project-level grouping. These are useful, but they are too complex for the current MVP.

The MVP roadmap now prioritizes:
- memory-level editing
- on-device date/location suggested memories
- user-led theme picker flows
- simple finalization

## Current MVP architecture direction

### User-visible entities
- Project
- Memory
- Suggested Memory
- Theme Page
- Finalization

### Internal entities
- LibraryScanCandidate
- SuggestionCandidatePhotoRef
- SuggestedMemoryCandidate
- ThemePhotoSelection

### Hidden/dev-only infrastructure
- single-image analysis inspector
- cluster inspector
- media-library probe tools
- raw ML Kit label/face debug output

## Status as of 2026-09-02

### Implemented or partly implemented
- Project and memory records include timeline, assist/style, finalization, memory kind, status, and theme metadata.
- `SuggestionCandidatePhotoRef` exists for MediaLibrary-backed temporary suggestion candidates.
- `scanMediaLibrarySuggestionsForProject` scans local MediaLibrary assets by project bounds, builds temporary refs, runs the project cluster engine, and creates event suggestions without importing photos.
- Suggestion upsert/status helpers preserve non-new lifecycle state across repeated scans and clear dismissed candidate refs.
- Android Photo Picker integration exists for explicit manual memory/theme imports and records picker-fallback metadata.
- Dev analysis, cluster, and MediaLibrary probe surfaces are guarded through `DEV_TOOLS_ENABLED`.

### Product-critical gaps
- Accepted suggestion flow still needs a complete review/select/import step that copies only selected candidate assets into `PhotoItem` records for the created memory.
- Scan cadence fields such as `scanInterval` and `lastScanAt` are not yet part of `Project`.
- Theme pages are represented by collection-style memories; this is acceptable for MVP, but the create/add-to-existing flow should stay user-led.
- Finalization should be reconciled so it only works from accepted memory/theme content, not raw project-pool assumptions.
- Legacy/internal project-level photo import APIs still exist and should remain hidden from normal UX unless used for migration or dev support.

## Phase 1 — MVP UI reset

### Goal
Simplify the project screen and remove debug-heavy concepts from normal UX.

### Tasks
- hide project-level photo pool UI
- hide image analysis inspector behind dev-only access
- hide cluster inspector behind dev-only access
- hide media-library probe tools behind dev-only access
- preserve memory list and memory editor
- preserve suggested memory placeholder/section
- preserve finalization entry if already available

### Definition of done
Normal users see:
- project summary
- memories
- suggested memories
- suggested theme pages
- finalization

Normal users do not see:
- raw clusters
- raw native labels
- raw face metadata
- probe buttons
- project photo management

Status: largely implemented. Keep auditing new project-screen controls so project-pool, inspector, cluster, and probe concepts remain dev-only.

## Phase 2 — On-device library scan for suggested memories

### Goal
Generate suggested event memories from local media-library metadata without requiring project-level photo import.

### Inputs
- project timeline mode
- start/end date
- scan interval
- on-device media-library assets
- timestamp
- GPS/location when available
- asset id
- dimensions
- optional face/quality signals

This phase should use the MediaLibrary/canonical asset path, not Android Photo Picker results, because GPS/location and stable asset ids are suggestion-scan inputs.

### Output
SuggestedMemory candidates with:
- id
- projectId
- title
- candidate photo refs
- date span
- location summary
- score
- explanation
- status:
  - new
  - snoozed
  - accepted
  - rejected

### Requirements
- scan by date range
- detect bursts/time clusters
- detect location clusters and location changes
- do not import candidate photos automatically
- on accept, import selected photos into a normal memory
- on reject, discard candidate refs
- preserve stable suggestion ids across repeated scans

Status: scanner and temporary ref generation are implemented. Remaining work is the user-reviewed candidate selection/import step on acceptance and broader device validation.

## Phase 3 — Ongoing and hybrid scan behavior

### Goal
Make ongoing and hybrid projects useful without depending on unreliable background scheduling.

### Scan interval options
- manual
- 1 day
- 1 week
- 1 month

### MVP behavior
- scan manually
- scan on project open when interval elapsed
- record lastScanAt
- dedupe against accepted/rejected/snoozed suggestions

Status: manual scan behavior exists; interval persistence and project-open cadence remain to be added.

### Deferred
- true background scanning
- push notifications
- cross-device sync

## Phase 4 — Theme page picker/search

### Goal
Support user-led theme pages using picker/search flows.

### Workflow
1. user chooses a suggested theme or enters custom term
2. app opens Android Photo Picker search-highlight flow where available
3. user selects photos
4. user chooses create new theme or add to existing theme
5. app imports selected photos at highest available quality

### Android implementation direction
Use Android Photo Picker search highlighting where available:
- `EXTRA_PICK_IMAGES_HIGHLIGHT_SEARCH_RESULTS`
- `KEY_PICK_IMAGES_HIGHLIGHT_SEARCH_TEXT_QUERY`

Fallback:
- show the suggested search term in the app
- open picker normally
- user searches/selects manually

### Requirements
- selected photos only
- no unattended cloud scanning
- preserve source dimensions
- preserve highest available/original-quality source
- record source metadata available from the picker
- do not require GPS/canonical MediaStore ids for manual Photo Picker imports

Status: Android picker integration and picker-fallback metadata exist. Complete the product flow as create-new-theme/add-to-existing collection memory, unless a separate `ThemePage` entity becomes necessary.

### Metadata note
Android Photo Picker imports are the preferred manual memory/theme UX because search highlighting helps users find photos. On tested Android providers, Photo Picker URIs may reject unredacted EXIF/GPS reads even when `ACCESS_MEDIA_LOCATION` is granted and `MediaStore.setRequireOriginal()` is requested. GPS-dependent features should therefore use the MediaLibrary-backed scan path in Phase 2.

### Deferred
- iOS equivalent
- web equivalent
- automatic theme clustering
- Gemini/Nano interpretation
- CLIP/vector grouping

## Phase 5 — Finalization

### Goal
Help users finish a book using already accepted material.

### Inputs
- photos in accepted memories
- photos in accepted theme pages

### Behavior
- show unused accepted photos
- allow user to add to pages or discard
- suggest simple wrap-up pages

### Deferred
- scanning entire raw library during finalization
- automatic book generation
- commerce/order flow

## Phase 6 — Future intelligence

### Later improvements
- optional native image analysis
- better quality scoring
- person/profile features
- Gemini/Nano cluster interpretation
- cloud picker integration
- iOS/web parity

These should not block the MVP.

## Engineering rules for MVP reset

### Do
- keep memory editor stable
- use temporary MediaLibrary candidate refs for suggested memories
- keep accepted photos as memory/theme photos
- keep scans scoped to project settings
- preserve canonical media resolver work
- preserve Android GPS handling for MediaLibrary-backed scans
- preserve suggestion lifecycle state across scans
- keep project-level photo APIs internal/legacy unless deliberately promoted

### Do not
- expose project photo pool as normal UX
- auto-import suggestion photos
- depend on raw ML Kit labels for core MVP behavior
- depend on cloud Google Photos full-library scanning
- require full image analysis for suggested memories
- expand debug tooling in normal UX
- require Photo Picker imports to provide GPS or canonical MediaStore asset ids
