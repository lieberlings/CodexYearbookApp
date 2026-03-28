# Active Work Plan — Milestone 3

## Project
Photobook app — memory-based, privacy-centric, low-effort photobook creation

## Milestone
Milestone 3 — Image analysis foundation, finalization, and person/profile groundwork

## Milestone goal
Increase the quality and usefulness of suggestions by introducing privacy-safe image-analysis metadata, then use that metadata to support stronger ranking and a first finalization experience.

This milestone should:
- add image-analysis metadata to photos
- add an analysis orchestration layer
- add coarse scene and quality signals
- improve suggestion and candidate-photo quality using that metadata
- introduce a first finalization flow
- prepare the architecture for later person/profile features

This milestone should **not**:
- jump straight to full person recognition
- depend on cloud analysis by default
- build a heavy background processing system too early
- turn the app into a fully autonomous book builder

---

## Core documents for every Codex task
Before each substantial Codex task, point Codex to:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3.md`

---

## Milestone 3 phases

### Phase A — Image-analysis metadata foundation
Goal:
- add analysis metadata
- add orchestrator/services
- keep everything local-first and side-effect safe

### Phase B — Improve suggestion quality using metadata
Goal:
- rank better suggestions
- improve event and collection matching
- improve candidate photo additions

### Phase C — Finalization foundation
Goal:
- add a guided end-stage flow for missing moments, strongest unused photos, and recurring highlight opportunities

### Phase D — Person/profile groundwork
Goal:
- design privacy-safe hooks for later face/person features without implementing full recognition too early

---

## Milestone 3 tasks

### Task 1 — Add photo analysis metadata model and persistence
**Status:** completed

#### Goal
Extend the photo model so image-analysis outputs can be stored compactly and migration-safely.

#### Scope
Add a metadata block or equivalent fields for:
- analysis version
- analyzed timestamp
- quality score / blur-like flags
- scene/theme tags
- portrait/group cues
- face count / simple face flags
- duplicate-like grouping fields
- safe external tags
- optional local-only reference fields for future sensitive metadata

#### Constraints
- keep the data model compact
- preserve backward compatibility for existing saved photos
- do not yet implement actual analysis logic in this task
- do not redesign the entire photo model

#### Files Codex should inspect first
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`
- `src/context/appDataHelpers.ts`
- any files that define `PhotoItem` or photo persistence
- any recent Milestone 2 project-photo-pool code

#### Definition of done
- photos can persist analysis metadata safely
- old saved data still loads
- the model clearly separates generalized vs sensitive metadata

---

### Task 2 — Add photo analysis orchestrator and service boundaries
**Status:** completed

#### Goal
Create a clean analysis orchestration layer that can run image-analysis services and persist their outputs.

#### Scope
Add service boundaries such as:
- `photoAnalysisOrchestrator`
- `photoQualityService`
- `sceneAnalysisService`
- optional `faceDetectionService` scaffold
- optional `photoSimilarityService` scaffold

The orchestrator should:
- accept project/photo inputs
- decide what needs analysis
- merge results back into stored metadata
- avoid duplicate reprocessing where possible

#### Constraints
- keep the orchestrator side-effect safe except for metadata persistence
- do not create memories or layout changes here
- do not add person recognition yet
- do not build heavy background job infrastructure yet

#### Files Codex should inspect first
- `src/context/AppContext.tsx`
- `src/context/appDataHelpers.ts`
- `src/types.ts`
- existing service files
- photo query / project scan code
- recent Milestone 2 suggestion and photo-pool logic

#### Definition of done
- a clean service/orchestrator layer exists
- analysis outputs can be merged into photo metadata
- the structure is ready for coarse analysis implementations next

---

### Task 3 — Implement coarse quality analysis
**Status:** not started

#### Goal
Add lightweight quality-related metadata that helps the app choose stronger photos.

#### Scope
Implement initial heuristics/signals such as:
- quality score
- blur-ish or weak-image flag
- hero-candidate score
- maybe low-light or weak-image flags if practical

#### Constraints
- keep the first version lightweight
- do not attempt a sophisticated aesthetic model
- avoid fragile overfitting to one use case
- keep it local-first

#### Files Codex should inspect first
- `photoAnalysisOrchestrator`
- `photoQualityService`
- photo-related types/storage files
- any suggestion-ranking helpers

#### Definition of done
- photos can receive initial quality metadata
- the output is useful for ranking and filtering later

---

### Task 4 — Implement coarse scene/content tagging
**Status:** not started

#### Goal
Add generalized scene/content tags that improve suggestions and styling cues.

#### Scope
Generate coarse tags such as:
- indoor / outdoor
- portrait / group
- landscape / scenic
- beach / water-like
- food-like
- city-like
- party-like
- hiking / nature-like if practical

#### Constraints
- keep tags coarse and generalized
- do not add person recognition yet
- keep sensitive outputs out of external-facing metadata by default
- keep implementation local-first or scaffolded cleanly if native integration is deferred

#### Files Codex should inspect first
- `sceneAnalysisService`
- `photoAnalysisOrchestrator`
- photo-related types/storage files
- `src/services/promptEngine.ts`

#### Definition of done
- photos can receive coarse scene/content tags
- those tags are usable by suggestion logic and later decorative cues

---

### Task 5 — Integrate analysis metadata into suggestion quality
**Status:** not started

#### Goal
Use image-analysis metadata to improve the current suggestion system.

#### Scope
Improve:
- event suggestion ranking
- collection candidate ranking
- candidate photo additions to existing memories
- hero-photo preference

Use quality and scene metadata where available.

#### Constraints
- do not rewrite the whole suggestion system
- preserve existing project-scoped suggestion flow
- keep user control unchanged
- do not silently mutate memories

#### Files Codex should inspect first
- `src/services/promptEngine.ts`
- `src/context/AppContext.tsx`
- photo analysis service/orchestrator files
- candidate-photo suggestion helpers
- collection candidate helpers

#### Definition of done
- suggestion quality is measurably better using metadata
- weaker photos can be deprioritized
- stronger candidate photos rise naturally

---

### Task 6 — Add a finalization entry point and data model
**Status:** not started

#### Goal
Create the structural beginning of the finalization phase.

#### Scope
Add:
- project-level finalization entry point
- finalization section or route
- finalization suggestion type(s) if needed
- basic finalization state for the project

#### Constraints
- keep the UX simple
- do not build the full polished flow in one task
- do not redesign the whole project screen
- preserve the optional nature of finalization

#### Files Codex should inspect first
- project detail screens
- suggestion UI surfaces
- `src/context/AppContext.tsx`
- `src/types.ts`
- project-status or project-settings files

#### Definition of done
- a project can enter a basic finalization flow
- the architecture supports finalization-specific suggestions

---

### Task 7 — Add missing moments and strongest unused photos to finalization
**Status:** not started

#### Goal
Make finalization useful by surfacing meaningful end-stage opportunities.

#### Scope
Add finalization suggestions for:
- missing moments
- strongest unused photos
- underrepresented date ranges
- possibly weak ending / cover candidates later if it comes naturally

#### Constraints
- keep review explicit
- do not auto-insert pages
- use metadata and existing heuristics where available
- keep this additive, not overbuilt

#### Files Codex should inspect first
- finalization entry/UI files
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- photo analysis metadata files
- project photo pool helpers

#### Definition of done
- finalization can surface missing moments and best-unused-photo opportunities
- the user can review them clearly

---

### Task 8 — Add recurring highlight collections to finalization
**Status:** not started

#### Goal
Surface broader recurring themes near the end of the project.

#### Scope
Add finalization suggestions for:
- recurring scenic moments
- recurring beach/nature/food-like themes
- group/photo highlight opportunities
- “across the project” collections that were not strong enough earlier

#### Constraints
- do not require person recognition yet
- keep suggestions clearly optional
- do not overwhelm the user with too many ideas

#### Files Codex should inspect first
- finalization UI files
- collection memory / collection suggestion files
- `src/services/promptEngine.ts`
- project photo pool helpers
- photo analysis metadata helpers

#### Definition of done
- finalization can propose a small set of meaningful recurring highlights
- users can review them without clutter

---

### Task 9 — Add privacy-safe face detection groundwork
**Status:** not started

#### Goal
Lay the foundation for later person/profile features without implementing full recognition.

#### Scope
Add:
- face-count metadata
- portrait/group enhancement signals
- possible local-only face data references if needed
- clear separation between generalized metadata and sensitive metadata

#### Constraints
- do not implement named person recognition yet
- do not send face data to external services
- keep the feature optional and privacy-safe by design

#### Files Codex should inspect first
- photo analysis metadata files
- `faceDetectionService` if present
- orchestrator files
- photo-related types/storage files
- privacy or settings-related code if relevant

#### Definition of done
- the model and services can support face-related metadata safely
- the product remains privacy-centric

---

### Task 10 — Add focused tests for Milestone 3 foundations
**Status:** not started

#### Goal
Add focused tests for the new metadata, orchestration, suggestion integration, and finalization foundations.

#### Scope
Prioritize tests for:
- photo analysis metadata persistence and normalization
- orchestrator behavior
- quality/scene metadata output contracts
- suggestion ranking integration
- finalization suggestion generation

#### Constraints
- keep tests focused
- do not add tests for full person recognition or future commerce/collaboration
- prefer stable contract tests over brittle implementation snapshots

#### Files Codex should inspect first
- relevant test setup files
- photo analysis metadata files
- orchestrator/service files
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- finalization suggestion logic

#### Definition of done
- Milestone 3 foundation behaviors have focused coverage
- key remaining risks are documented

---

## Current assumptions to preserve
- the app remains phone-first
- the product remains local-first
- project-scoped user control remains essential
- smart features guide rather than decide
- privacy is a visible product principle
- yearbooks and vacations remain the primary optimization targets

---

## Out of scope for Milestone 3
Do not implement yet:
- full named person recognition
- cloud-based face recognition by default
- ordering/commerce
- real-time collaboration editing
- broad web-side image-analysis parity
- fully automated book creation

---

## Risks to watch during Milestone 3
- metadata bloat in storage
- analysis latency on large projects
- unclear privacy boundaries for face-related data
- suggestion quality getting noisier instead of better
- finalization becoming a dumping ground for too many ideas

---

## Definition of done for Milestone 3
Milestone 3 is complete when:
- photos can persist useful analysis metadata
- suggestion quality improves using that metadata
- the app has a first real finalization flow
- privacy-sensitive analysis remains clearly separated
- the architecture is ready for later person/profile features without having implemented them prematurely

---

## Recently completed
- Milestone 1: project-scoped suggestion foundation
- Milestone 2: project photo pool, collections, watching, candidate additions, stabilization, and focused foundation tests
- Milestone 3: photo analysis metadata model, persistence, and orchestration scaffolding

---

## Likely next milestone after Milestone 3
Milestone 4 — Person/profile experience and stronger privacy-visible personalization

Potential focus:
- named local profiles
- person-aware collections
- private family-centric suggestions
- stronger emotional yearbook features

---

## How to use this file during execution
Before each Codex task:
1. update the matching task `Status`
2. point Codex to this file and the core docs
3. keep the Codex task scoped
4. review the diff carefully
5. test locally
6. commit after each successful slice
7. update:
   - task `Status`
   - `Recently completed`
   - any changed risks / assumptions
