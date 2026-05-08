# MVP Reset Task Prompts

## Purpose
This file contains copy-paste prompts for the MVP reset.

Use these prompts after updating:
- `docs/codex/active_work_plan_mvp_reset.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `ARCHITECTURE.md`
- `docs/engineering/image_analysis_pipeline_design.md`

---

## Task 1 — Simplify project screen to memory-first MVP

### Prompt
Before making any changes, read:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_mvp_reset.md`

Focus specifically on:
- returning to memory-level photo editing only
- hiding project-level photo management
- hiding debug/image-analysis/cluster tools from normal project UX
- preserving useful tools behind dev-only access

Then inspect:
- `app/project/[id].tsx`
- `src/context/AppContext.tsx`
- `src/types.ts`
- `src/services/projectClusterEngine.ts`
- `src/services/promptEngine.ts`
- `src/components/MediaLibrarySelectionModal.tsx`
- any inspector/debug UI components

Implement a narrow MVP project-screen cleanup.

Requirements:
- normal project screen should emphasize:
  - project summary
  - memories
  - suggested memories
  - suggested theme pages
  - finalization entry if available
- hide from normal user flow:
  - project-level photo pool UI
  - single-image analysis inspector
  - cluster inspector
  - media-library probes
  - raw native label/face debug panels
- preserve debug tools behind dev-only access if they remain useful
- keep memory editor behavior unchanged
- do not implement the new library-scan suggestion model yet

Constraints:
- no broad redesign
- no native changes
- no new image-processing behavior
- no Google Photos cloud integration
- do not delete underlying services unless clearly unused

After editing, provide:
1. what was hidden from normal UX
2. how debug tools can still be accessed
3. what user-facing project flow remains
4. what was intentionally deferred
5. whether testing requires `npx expo start --dev-client` only or `npx expo run:android`

---

## Task 2 — Add library-scan suggested memories from on-device media metadata

### Prompt
Before making any changes, read:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/active_work_plan_mvp_reset.md`

Focus specifically on:
- suggested memories from on-device media-library metadata
- temporary candidate photo refs
- no project-level photo pool
- accept/reject/snooze workflow

Then inspect:
- `src/services/photoCanonicalResolver.ts`
- `src/services/photoCanonicalResolver.android.ts`
- `src/services/photoService.ts`
- `src/services/promptEngine.ts`
- `src/context/AppContext.tsx`
- `src/types.ts`
- `app/project/[id].tsx`

Implement a first MVP library-scan suggested memory path.

Requirements:
- scan on-device media library within project date range
- generate event-like suggestions from:
  - time bursts
  - date proximity
  - GPS/location clusters
  - location changes
  - photo counts
- use temporary candidate photo refs, not project photos
- show suggested memories for review
- support accept/reject/snooze
- on accept, user selects photos and app creates a normal memory
- on reject, candidate refs are discarded
- preserve stable suggestion ids across repeated scans

Constraints:
- do not require image analysis
- do not use cloud Google Photos scanning
- do not auto-import candidate photos
- do not change memory editor behavior
- do not reintroduce project photo pool UX

After editing, provide:
1. candidate/ref model introduced
2. scan behavior
3. suggestion scoring
4. accept/reject/snooze behavior
5. how selected photos become memory photos
6. what was deferred

---

## Task 3 — Add scan interval behavior for ongoing/hybrid projects

### Prompt
Before making any changes, read:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/active_work_plan_mvp_reset.md`

Focus specifically on:
- ongoing/hybrid project scan interval
- manual / 1 day / 1 week / 1 month
- scan on project open or manual trigger
- no true background scheduling yet

Implement scan interval support for suggested memories.

Requirements:
- project stores scan interval
- project stores lastScanAt
- manual scan remains available
- when project opens, scan if interval has elapsed
- do not duplicate accepted/rejected/snoozed suggestions
- keep scans on-device only

Constraints:
- do not implement push/background jobs yet
- do not add cloud scanning
- do not alter memory editor

After editing, provide:
1. project fields added/used
2. scan trigger behavior
3. dedupe behavior
4. what background behavior is deferred

---

## Task 4 — Add user-led theme page picker/search flow

### Prompt
Before making any changes, read:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/active_work_plan_mvp_reset.md`

Focus specifically on:
- suggested theme pages as user-led picker/search flows
- Android Photo Picker search highlighting where available
- selected photos only
- create new theme or add to existing theme

Then inspect:
- current media picker/selection code
- native Android picker integration points
- `src/components/MediaLibrarySelectionModal.tsx`
- `src/context/AppContext.tsx`
- `src/types.ts`
- `app/project/[id].tsx`

Implement a first user-led theme page selection flow.

Requirements:
- provide a short list of suggested themes
- allow custom theme/search term
- on Android, use Photo Picker search highlighting where available:
  - `EXTRA_PICK_IMAGES_HIGHLIGHT_SEARCH_RESULTS`
  - `KEY_PICK_IMAGES_HIGHLIGHT_SEARCH_TEXT_QUERY`
- fallback gracefully when search highlighting is unavailable
- user selects photos
- user chooses create new theme or add to existing theme
- import selected photos at highest available quality
- record source dimensions

Constraints:
- do not auto-import search results
- do not depend on unattended cloud scanning
- do not implement automatic theme clustering
- do not implement iOS/web yet
- preserve memory editor behavior

After editing, provide:
1. theme picker/search UI added
2. Android search-highlight implementation
3. fallback behavior
4. create/add-to-existing behavior
5. quality/dimension handling
6. whether `npx expo run:android` is required

---

## Task 5 — Finalization over accepted content only

### Prompt
Before making any changes, read:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/active_work_plan_mvp_reset.md`

Focus specifically on:
- finalization using accepted memories and theme pages only
- unused accepted photos
- no raw-library scan during finalization

Implement MVP finalization cleanup.

Requirements:
- gather unused photos from accepted memories/theme pages
- allow user to use or discard
- suggest simple add-to-page actions
- do not scan the raw library automatically
- keep user control explicit

Constraints:
- do not implement commerce
- do not implement automatic book generation
- do not add cloud scanning

After editing, provide:
1. finalization inputs
2. unused photo detection
3. user actions
4. what was deferred