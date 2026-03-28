# Milestone 3 Task Prompts

## Purpose

This file contains copy-paste prompts for Codex in VS Code for:

**Milestone 3 — Image analysis foundation, finalization, and person/profile groundwork**

Use these prompts in order.
Do not skip ahead unless the current task is complete, reviewed, and committed.

Each prompt explicitly points Codex to the core planning documents and the matching task in:
- `docs/codex/active_work_plan_milestone_3.md`

This is intentional. Do not assume Codex will retain prior session context.

---

## Shared instruction pattern

Every task below:
- points Codex to the core docs
- points Codex to the matching task in `docs/codex/active_work_plan_milestone_3.md`
- identifies the code files to inspect
- states constraints and out-of-scope items
- asks for a bounded result

Use these prompts as written, then review each diff carefully.

---

## Task 1 — Add photo analysis metadata model and persistence

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 1 — Add photo analysis metadata model and persistence**

Then read these code files:
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`
- `src/context/appDataHelpers.ts`
- any files that define `PhotoItem` or photo persistence
- any recent Milestone 2 project-photo-pool code

Implement the smallest safe additive change to support persisted photo analysis metadata.

Requirements:
- extend the photo model to support a compact analysis metadata block or equivalent fields
- include fields for:
  - analysis version
  - analyzed timestamp
  - quality-related metadata
  - coarse scene/theme tags
  - portrait/group cues
  - simple face-count flags
  - duplicate/similarity hooks
  - safe external tags
  - optional local-only reference fields for future sensitive metadata
- persist the new metadata in a migration-safe way
- preserve backward compatibility for existing saved photos
- keep the model compact and future-friendly
- prefer shared pure helper normalization where appropriate, consistent with the recent `appDataHelpers` refactor

Constraints:
- do not implement actual analysis logic yet
- do not redesign the entire photo model
- do not add UI in this task
- do not add person recognition yet
- keep the separation between generalized metadata and sensitive metadata clear
- do not overpopulate the metadata model with speculative fields that are unlikely to be used soon

After editing, provide:
1. the data model used for photo analysis metadata
2. how it is persisted and normalized
3. how generalized vs sensitive metadata are separated
4. any follow-up constraints for Task 2
5. whether any shared helper logic was added or updated

### What to review
- Is the metadata model compact and additive?
- Do old saved photos still load safely?
- Is there a clear privacy boundary in the model?
- Was UI avoided?

---

## Task 2 — Add photo analysis orchestrator and service boundaries

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 2 — Add photo analysis orchestrator and service boundaries**

Then read these code files:
- `src/context/AppContext.tsx`
- `src/context/appDataHelpers.ts`
- `src/types.ts`
- existing service files
- photo query / project scan code
- recent Milestone 2 suggestion and photo-pool logic

Create a clean image-analysis orchestration layer and service boundaries.

Requirements:
- add service boundaries such as:
  - `photoAnalysisOrchestrator`
  - `photoQualityService`
  - `sceneAnalysisService`
  - optional `faceDetectionService` scaffold
  - optional `photoSimilarityService` scaffold
- the orchestrator should:
  - accept photo/project inputs
  - decide what needs analysis
  - merge metadata results back into persisted photos
  - avoid duplicate reprocessing where practical
- keep the architecture local-first and modular

Constraints:
- do not implement full native ML integration yet unless the current stack already has it ready
- do not create memories or mutate editorial state here
- do not add person recognition yet
- do not add broad UI in this task
- do not build a heavy background job system yet

After editing, provide:
1. the new service boundaries
2. how the orchestrator reads/writes photo metadata
3. how reprocessing avoidance works
4. what remains stubbed for later native integration

### What to review
- Is there a clean service structure now?
- Did the orchestrator stay focused on metadata only?
- Was the design kept extensible without being overbuilt?
- Did it avoid editorial side effects?

---

## Task 3 — Implement coarse quality analysis

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 3 — Implement coarse quality analysis**

Then read these code files:
- `photoAnalysisOrchestrator`
- `photoQualityService`
- photo-related types/storage files
- suggestion-ranking helpers if any

Implement the first lightweight quality-analysis pass.

Requirements:
- produce coarse quality-related metadata such as:
  - quality score
  - blur-ish or weak-image flag
  - hero-candidate score
  - optional low-light or weak-image flags if practical
- keep outputs stable and heuristic-friendly
- keep analysis local-first
- make the output persist through the new metadata path

Constraints:
- do not attempt sophisticated aesthetic modeling
- do not introduce native ML dependency if a lighter first pass is more appropriate
- do not change UI in this task unless tiny debug surfacing is strictly necessary
- do not add person recognition yet

After editing, provide:
1. what quality signals were implemented
2. how they are computed at a high level
3. how they are persisted
4. how reliable vs heuristic these signals are

### What to review
- Are the signals useful but lightweight?
- Are they persisted correctly?
- Did this avoid overpromising “quality AI”?
- Is the output ready for ranking use next?

---

## Task 4 — Implement coarse scene/content tagging

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 4 — Implement coarse scene/content tagging**

Then read these code files:
- `sceneAnalysisService`
- `photoAnalysisOrchestrator`
- photo-related types/storage files
- current suggestion logic in `src/services/promptEngine.ts`

Implement a first coarse scene/content tagging layer.

Requirements:
- generate generalized scene/content tags such as:
  - indoor / outdoor
  - portrait / group
  - landscape / scenic
  - beach / water-like
  - food-like
  - city-like
  - party-like
  - hiking/nature-like if practical
- persist those tags into photo analysis metadata
- keep tags coarse and generalized
- maintain a clear distinction between safe generalized tags and future sensitive metadata

Constraints:
- do not implement person recognition yet
- do not add cloud analysis by default
- do not over-engineer a complete CV system in this task
- keep integration modular so native/platform analysis can be swapped in later if currently stubbed

After editing, provide:
1. what tags were added
2. how they are generated or scaffolded
3. how they are stored
4. what limitations remain before these tags become strongly reliable

### What to review
- Are tags generalized and useful?
- Is the privacy boundary preserved?
- Did it stay modular?
- Is it ready to feed suggestion improvements next?

---

## Task 5 — Integrate analysis metadata into suggestion quality

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 5 — Integrate analysis metadata into suggestion quality**

Then read these code files:
- `src/services/promptEngine.ts`
- `src/context/AppContext.tsx`
- photo analysis service/orchestrator files
- candidate-photo suggestion helpers
- collection candidate helpers

Use the new photo analysis metadata to improve the current suggestion system.

Requirements:
- improve event suggestion quality using metadata such as:
  - quality score
  - hero-candidate score
  - coarse scene tags
  - portrait/group cues
- improve collection candidate ranking using metadata where appropriate
- improve candidate photo additions to memories
- preserve the existing suggestion lifecycle and user control
- keep the implementation additive and reviewable

Constraints:
- do not rewrite the whole suggestion engine
- do not auto-modify memories or pages
- do not add person recognition yet
- do not add finalization in this task
- keep repeated scans/reconciliation behavior intact

After editing, provide:
1. what suggestion paths now use analysis metadata
2. what ranking/filtering improvements were added
3. what remained heuristic-only
4. the biggest current limitations before finalization work

### What to review
- Did suggestion quality improve in bounded ways?
- Did user control remain unchanged?
- Was the change additive rather than a rewrite?
- Did metadata actually get used where it matters?

---

## Task 6 — Add a finalization entry point and data model

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 6 — Add a finalization entry point and data model**

Then read these code files:
- project detail screens
- suggestion UI surfaces
- `src/context/AppContext.tsx`
- `src/types.ts`
- project-status or project-settings files

Create the structural beginning of the finalization phase.

Requirements:
- add a project-level finalization entry point
- add any needed project-level finalization state
- add finalization suggestion type(s) if needed
- keep the UX simple and clearly optional
- preserve the current project workflow

Constraints:
- do not build the full polished finalization flow in one task
- do not redesign the whole project screen
- do not auto-insert pages or memories
- keep this as a structural first step

After editing, provide:
1. where finalization starts in the UI
2. what state/model changes were added
3. how finalization suggestions are represented if applicable
4. what is intentionally deferred to later tasks

### What to review
- Is there now a clear finalization entry point?
- Is it optional and not overwhelming?
- Was the architecture prepared without overbuilding?
- Did it preserve the current project flow?

---

## Task 7 — Add missing moments and strongest unused photos to finalization

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 7 — Add missing moments and strongest unused photos to finalization**

Then read these code files:
- finalization entry/UI files
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- photo analysis metadata files
- project photo pool helpers

Add useful finalization suggestions for missing moments and strongest unused photos.

Requirements:
- surface missing moments or underrepresented time ranges
- surface strongest unused photos
- use available quality and scene metadata where helpful
- keep user review explicit
- preserve the optional nature of finalization

Constraints:
- do not auto-insert pages
- do not build a huge polished wizard yet
- do not require person recognition
- keep this additive and understandable

After editing, provide:
1. what finalization suggestions were added
2. how they are generated
3. how users review them
4. what remains limited or heuristic-driven

### What to review
- Does finalization now feel meaningfully useful?
- Are missing moments and best-unused-photo suggestions understandable?
- Was user control preserved?
- Did this avoid overcomplication?

---

## Task 8 — Add recurring highlight collections to finalization

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 8 — Add recurring highlight collections to finalization**

Then read these code files:
- finalization UI files
- collection memory / collection suggestion files
- `src/services/promptEngine.ts`
- project photo pool helpers
- photo analysis metadata helpers

Add recurring highlight collection opportunities to finalization.

Requirements:
- surface a small set of meaningful recurring highlights such as:
  - scenic moments
  - beach/nature/food-like highlights
  - group-photo highlights
  - across-the-project collections not surfaced strongly earlier
- keep suggestions optional and clearly additive
- use metadata and existing collection logic where helpful

Constraints:
- do not require person recognition yet
- do not flood finalization with too many ideas
- do not redesign the whole collection system in this task
- keep the experience lightweight and understandable

After editing, provide:
1. what recurring highlight opportunities are surfaced
2. how they are generated
3. how they are presented in finalization
4. what remains future work before a more complete finalization experience

### What to review
- Are the finalization highlight suggestions meaningful?
- Is the list restrained rather than noisy?
- Does it build naturally on Milestone 2 collection logic?
- Did it avoid premature person-aware logic?

---

## Task 9 — Add privacy-safe face detection groundwork

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_3.md` → **Task 9 — Add privacy-safe face detection groundwork**

Then read these code files:
- photo analysis metadata files
- `faceDetectionService` if present
- orchestrator files
- photo-related types/storage files
- privacy or settings-related code if relevant

Add privacy-safe groundwork for face-related metadata without implementing full person recognition.

Requirements:
- support face-count or simple face-related metadata
- support portrait/group enhancement signals
- keep any sensitive/local-only data clearly separated from generalized metadata
- keep the design ready for future person/profile features
- preserve the product’s privacy-centric posture

Constraints:
- do not implement named person recognition yet
- do not send face data to external services
- do not add cloud identity processing
- do not add broad UI unless a tiny settings/debug hook is strictly needed

After editing, provide:
1. what face-related metadata is now supported
2. how privacy boundaries are maintained
3. what remains intentionally unimplemented
4. what the clean next step would be toward later profile/person features

### What to review
- Is this clearly groundwork rather than full recognition?
- Is sensitive data separated well?
- Does it align with the product privacy promise?
- Did it avoid overreach?

---

## Task 10 — Add focused tests for Milestone 3 foundations

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

Focus specifically on:
- the completed Milestone 3 tasks so far in `docs/codex/active_work_plan_milestone_3.md`

Then read these code files:
- relevant test setup files
- photo analysis metadata files
- orchestrator/service files
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- finalization suggestion logic

Add focused tests for Milestone 3 foundational behavior.

Priority areas:
- metadata persistence and normalization
- orchestrator behavior
- quality/scene metadata contracts
- suggestion integration using analysis metadata
- finalization suggestion generation
- face-related metadata separation if already implemented

Constraints:
- keep tests focused
- avoid broad test refactors
- do not add tests for future full person recognition, commerce, or collaboration
- prefer stable contract tests over brittle implementation snapshots

After editing, provide:
1. what is covered
2. notable gaps
3. brittle areas or technical debt revealed by the tests
4. the most important remaining untested risks before the next milestone