# Active Work Plan — MVP Reset

## Project
Photobook app — memory-first MVP reset

## Milestone
MVP Reset — memory-level editing, on-device suggested memories, and user-led theme pages

## Status as of 2026-09-02
The reset is now partly implemented and should be treated as the active governing direction, not just a proposal.

Already present:
- memory-first project and memory flows
- project timeline, assist/style, and finalization metadata
- `SuggestionCandidatePhotoRef` for temporary MediaLibrary-backed suggestion candidates
- MediaLibrary suggestion scanning through `scanMediaLibrarySuggestionsForProject`
- persisted suggestion lifecycle state for new, watching, snoozed, dismissed, and accepted suggestions
- Android Photo Picker support for explicit manual imports with picker-fallback metadata
- dev-only boundaries for analysis, probe, and cluster tools

Current priority gaps:
- complete the accepted-suggestion review/select/import flow so only chosen candidate photos become memory `PhotoItem`s
- add scan interval and `lastScanAt` persistence for ongoing/hybrid projects
- finish user-led theme-page create/add-to-existing behavior using collection-style memories unless a separate model becomes necessary
- align finalization with accepted memory/theme content only
- keep project-level photo import APIs internal/legacy rather than normal UX

## Why this reset exists
The app has grown into an advanced prototype with project-level photo pools, image-analysis inspectors, native ML Kit experiments, cluster inspectors, project-photo intake, and several overlapping suggestion systems.

Those systems are useful for learning, but the MVP should return to a simpler user experience:

- projects define scope
- memories remain the core editable unit
- photos become part of a project only through accepted memories or accepted theme pages
- suggested memories are generated from on-device media-library metadata
- theme pages are user-led picker/search flows
- advanced image analysis and cluster tools are hidden from normal users

## MVP product goal
Help users create photobooks with low effort while keeping them in control.

The MVP should allow users to:
1. create a project
2. define the project as past, ongoing, or hybrid
3. receive suggested event memories from on-device media-library scans
4. accept, reject, or snooze suggested memories
5. create and edit memories using the existing memory workflow
6. create theme pages through user-selected picker/search flows
7. finalize using photos already accepted into memories or theme pages

## User-visible workflow

### Project creation
A user creates a project with:
- project name
- thumbnail image
- timeline mode:
  - past
  - ongoing
  - hybrid
- date range when applicable
- scan interval for ongoing or hybrid projects:
  - manual
  - 1 day
  - 1 week
  - 1 month

For MVP, scheduled scanning does not need true background execution. It may run:
- manually
- when the project opens
- when the app is active
- when the scan interval has elapsed since the last scan

### Project screen
The normal project screen should focus on:
- project summary
- memories
- suggested memories
- suggested theme pages
- finalization entry

The normal project screen should not expose:
- project-level photo pool management
- single-image analysis inspector
- cluster inspector
- raw native image label debugging
- raw face-detection debugging
- media-library probe tools

Those tools may remain available behind a dev-only flag or internal debug route.

### Memories
Memories remain the core user-editable unit.

The existing memory/page editor should remain the main workflow for:
- photo selection inside a memory
- page layout
- text
- backgrounds
- borders
- ordering
- preview/export

Manual memory photo selection should use Android Photo Picker where available to benefit from picker search. GPS/canonical metadata is not required for manually selected memory photos in the MVP.

### Suggested memories
Suggested memories are event-focused.

They are generated from on-device media-library scans using:
- project date range
- photo timestamps
- photo bursts
- GPS/location clusters
- location changes
- photo count
- optional quality/face/group signals when already available

Suggested memories should not require mature image understanding.

A suggested memory contains temporary candidate photo references. These photos are not part of the project until the user accepts the suggestion and selects photos.

Suggested memory flow:
1. app scans the on-device media library within project scope
2. app generates event-like suggested memories
3. user expands/reviews suggested memories
4. user accepts, rejects, or snoozes
5. if accepted, user selects from the suggested photos
6. selected photos are imported into a normal memory
7. rejected suggestion candidate photos are discarded unless already used elsewhere

Accepting a suggestion means accepting the proposed memory, not importing every candidate photo automatically. The user-reviewed candidate selection step is required before candidate refs become `PhotoItem`s.

### Suggested theme pages
Theme pages are user-led, not fully automatic.

Theme-page workflow:
1. user chooses a suggested theme or enters a custom theme
2. app opens a picker/search flow for that theme
3. user selects photos
4. user chooses:
   - add to existing theme page
   - create new theme page
5. selected photos are imported into that theme page workflow

Suggested theme examples:
- Pets
- Christmas
- Desserts
- Hiking
- Funny faces
- Grandparents
- Beach
- First day of school
- Birthdays

On Android, use Photo Picker search highlighting where available:
- `EXTRA_PICK_IMAGES_HIGHLIGHT_SEARCH_RESULTS`
- `KEY_PICK_IMAGES_HIGHLIGHT_SEARCH_TEXT_QUERY`

If search highlighting is unavailable on a device, fall back to:
- showing the suggested search term in the app
- opening the picker normally
- letting the user search/select manually

Theme pages should not depend on unattended full-library cloud scanning.

Theme Photo Picker selections are explicit user imports. They may be stored as picker-fallback photos without GPS or canonical MediaLibrary asset ids. This is acceptable because GPS is only needed for suggestion scanning, not manual theme creation.

For MVP implementation, theme pages may remain collection-style memories with `themeLabel` and `themeTags`. Introduce a separate `ThemePage` entity only if the user-facing workflow or finalization model needs a distinct storage boundary.

### Cloud photo sources
MVP event scanning is limited to the on-device media library.

Cloud photo support remains on the roadmap:
- user-selected Google Photos / cloud-provider photos
- Android Photo Picker / Embedded Photo Picker flows
- future iOS equivalent
- future web upload/import flow

Cloud photos should be selected explicitly by the user.

On Android, use MediaLibrary/canonical assets for metadata-rich event scanning and Photo Picker for explicit user-selected imports. Do not try to derive reliable GPS suggestion signals from manual Photo Picker imports.

### Print-quality requirement
Imported photos should use the highest available quality/original-quality representation supported by the source.

The app should record:
- source dimensions
- imported dimensions
- source provider/path
- whether the selected photo may be below print-quality thresholds

For print, the app should eventually warn or deprioritize low-resolution photos.

### Finalization
Finalization should gather unused photos only from accepted user-controlled material:
- memories
- accepted theme pages

For MVP, finalization should not reopen the entire raw library automatically.

Finalization may help users:
- review unused photos already inside memories/theme pages
- add unused accepted photos to pages
- discard unused accepted photos
- create simple wrap-up pages

## Technical model

### Keep
- Project
- Memory
- Page/editor model
- PhotoItem for accepted/imported photos
- Suggestion lifecycle
- Canonical media resolver
- Android Media Library GPS work
- Native ML Kit experiments behind dev/debug access
- Cluster engine as internal/debug infrastructure

### Introduce or emphasize
- `LibraryScanCandidate`
- `SuggestedMemory`
- `SuggestionCandidatePhotoRef`
- `ThemePage`
- `ThemePhotoSelection`

### De-emphasize or hide
- project photo pool as user-facing concept
- raw clusters as user-facing concept
- image-analysis inspector as normal UX
- cluster inspector as normal UX

## Important distinctions

### Candidate photo refs are not project photos
A candidate photo ref is a temporary pointer to a source media-library asset.

It may contain:
- source asset id
- thumbnail/uri if available
- capturedAt
- location
- dimensions
- quality summary if available

It should not be treated as a project photo.

Candidate photo refs used for suggested memories should prefer MediaLibrary asset ids and metadata. Manual Photo Picker imports may not provide this data and should not be used as the primary source for GPS/location clustering.

### Accepted photos are memory photos
A photo becomes part of the project when:
- user accepts a suggested memory and selects photos
- user manually adds photos to a memory
- user creates/adds to a theme page

## Out of scope for MVP reset
Do not implement yet:
- full automatic theme clustering
- full-library image analysis
- person recognition
- cloud-based unattended Google Photos scanning
- commerce/order flow
- realtime collaboration
- polished image-analysis debug UI
- broad web-side photo intelligence

## Immediate implementation phases

### Phase 1 — UI cleanup
Goal:
Return the project screen to MVP simplicity.

Tasks:
- hide project photo pool UI from normal users
- hide single-image inspector behind dev access
- hide cluster inspector behind dev access
- hide media-library probe tools behind dev access
- keep memories and suggested memories prominent
- keep memory editor unchanged

### Phase 2 — On-device suggested memory scan
Goal:
Generate event suggestions from on-device media-library metadata without importing photos first.

Tasks:
- query local media library by project date range
- build event candidates from bursts and GPS/time clusters
- store candidate refs, not project photos
- support accept/reject/snooze
- on accept, import selected photos into a normal memory

Use MediaLibrary/canonical metadata for this phase. Do not rely on Android Photo Picker imports for GPS or stable asset ids.

Current state:
- scanner and temporary candidate refs exist
- repeated scan upserts preserve explicit lifecycle state
- accepted-suggestion candidate selection/import remains the next product-critical implementation step

### Phase 3 — Ongoing/hybrid scan interval
Goal:
Make ongoing projects useful without heavy background infrastructure.

Tasks:
- add scan interval field if not already present
- record last scan time
- trigger scans manually and on project open
- respect rejected/snoozed/accepted suggestions
- avoid duplicates

Current state:
- manual scanning exists
- `scanInterval` and `lastScanAt` still need to be added to the project model and persistence flow

### Phase 4 — Theme page picker/search
Goal:
Support user-led theme pages.

Tasks:
- short list of suggested themes
- custom theme input
- Android Photo Picker search highlighting where available
- create new theme or add to existing theme
- preserve highest available quality
- record dimensions and picker-available source metadata
- allow picker-fallback imports without GPS metadata

Current state:
- Android Photo Picker path exists
- theme pages should be completed as user-led collection-memory creation/addition before adding a separate model

### Phase 5 — Finalization cleanup
Goal:
Help users finish using accepted content only.

Tasks:
- gather unused accepted memory/theme photos
- allow user to use or discard
- suggest simple additional pages from accepted unused material

## Validation
For JS/TS-only changes:
- `npm test -- --runInBand`
- `npm exec tsc -- --noEmit`
- `npm run lint`
- `npx expo start --dev-client`

For native Android/config changes:
- `npx expo run:android`
- then `npx expo start --dev-client`
