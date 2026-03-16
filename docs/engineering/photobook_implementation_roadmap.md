# Photobook Implementation Roadmap

## Purpose

This roadmap translates the product vision into implementation phases that fit the existing architecture.

The current codebase already has strong foundations:
- local-first app structure
- `Project -> Memory -> PageSection -> Photo` domain model
- `AppContext` as central editing/data boundary
- shared preview/export/editor rendering assumptions
- basic prompt engine using burst/location/time logic

The goal is to extend this architecture, not replace it.

---

## Core Engineering Principles

### 1. Preserve canonical data flow
`AppContext` should remain the main orchestrator for project and memory operations.

### 2. Prefer extension over rewrite
Existing page generation, preview, export, and storage should be incrementally evolved.

### 3. Intelligence produces suggestions, not hidden mutations
New smart features should create suggestion objects that users can accept or dismiss.

### 4. Protect privacy boundaries explicitly
Sensitive analysis must remain local-first wherever feasible.

### 5. Build for yearbooks and vacations first
Every major decision should be evaluated against these use cases first.

---

## Target Domain Additions

## Project
Add fields such as:
- `projectType`
- `timelineMode` (`ongoing | past | hybrid`)
- `startDate`
- `endDate`
- `assistLevel`
- `styleIntensity`
- `privacyMode`
- `collaborators`
- `entityProfiles`
- `finalizationState`

## Memory
Add:
- `kind` (`event | collection | hybrid`)
- `status` (`suggested | watching | active | finalized | archived`)
- `membershipMode` (`time | semantic | mixed | manual`)
- `dateRange?`
- `themeTags`
- `hiddenTags`
- `placeholderPageCount?`
- `sourceSuggestionId?`

## Suggestion
New model:
- `id`
- `projectId`
- `type` (`event | collection | photo-addition | style | finalization`)
- `status` (`new | snoozed | dismissed | accepted`)
- `confidence`
- `reasons[]`
- `candidatePhotoIds[]`
- `candidateTags[]`
- `proposedTitle`
- `createdFromSignals`

## Photo metadata layer
Extend photo-level metadata handling:
- timestamp
- geodata if allowed
- image quality score
- duplicate/near-duplicate grouping
- scene/theme tags
- entity/person tags
- safe-to-external generalized tags

---

## Architecture Workstreams

### Workstream A: Domain model and persistence
Primary responsibility:
- types
- storage
- migrations
- model safety
- backward compatibility

Likely files:
- `src/types.ts`
- `src/storage.ts`
- migration helpers
- `src/context/AppContext.tsx`

### Workstream B: Suggestion engine
Primary responsibility:
- photo metadata extraction
- event clustering
- recurring collection detection
- suggestion generation
- explanation strings

Likely files:
- `src/services/promptEngine.ts` -> evolve into broader suggestion engine
- metadata helpers
- indexing/background scan services

### Workstream C: Project UX surfaces
Primary responsibility:
- project tabs/sections
- suggestions screen
- watching state
- finalization flow
- memory creation flows

Likely files:
- project screens
- prompt/suggestion UI
- memory detail/edit screens

### Workstream D: Layout and page-generation evolution
Primary responsibility:
- new page archetypes
- collection spread layouts
- finalization-added pages
- consistency with preview/export

Likely files:
- `src/layout/templates.ts`
- `src/layout/pagination.ts`
- related rendering components

### Workstream E: Privacy and sync
Primary responsibility:
- local sensitive analysis boundaries
- collaboration sync design
- safe external generation boundaries

---

## Phased Roadmap

## Phase 1 — Smart Project Setup & Suggestion Foundation

### Goal
Turn the app from a mostly manual photobook builder into a suggestion-driven builder without disrupting existing editing flows.

### Deliverables
1. Extend domain models:
   - `Memory.kind`
   - `Memory.status`
   - `Suggestion`
   - `Project.timelineMode`
   - `Project.assistLevel`
   - `Project.styleIntensity`

2. Add persistence and migrations for new fields.

3. Replace standalone “prompt center” thinking with project-scoped suggestions.

4. Add project settings UI for:
   - project type
   - timeline mode
   - assist level
   - style intensity
   - date range

5. Add retroactive scan on project creation.

6. Create first event-memory suggestions from existing signals:
   - time clusters
   - burst patterns
   - location changes

7. Add user actions:
   - accept
   - dismiss
   - snooze

8. Add “why suggested” explanation text.

### Acceptance criteria
- A user can create a yearbook or vacation project with a date range.
- The app can scan relevant photos and show project-scoped suggestions.
- Suggestions can be accepted into memories or dismissed.
- Existing editor, preview, and export still work.

### Notes
This phase should be conservative and low-risk.
Do not block progress on advanced AI or collaboration.

---

## Phase 2 — Event Detection Improvements & Collection Foundation

### Goal
Add useful recurring-theme support and make smart suggestions much more relevant for yearbooks and vacations.

### Deliverables
1. Improve event clustering logic:
   - better cluster grouping
   - dedupe handling
   - hero-photo selection improvements

2. Add collection memory support:
   - `kind = collection`
   - watching state
   - manual collection creation
   - collection metadata and rule scaffolding

3. Add collection suggestion generation for early supported themes:
   - faces/person profiles later
   - pets
   - hiking
   - scenic views
   - food highlights
   - family/group patterns where feasible

4. Add candidate photo-addition suggestions to existing memories.

5. Add collection-specific memory view behavior:
   - candidate photo count
   - recommended picks
   - “keep watching”
   - optional placeholder page count

### Acceptance criteria
- A project can contain both event and collection memories.
- A collection can be created manually or from suggestion.
- Collection suggestions can remain in watching state.
- Users can review and accept suggested photo additions.

### Notes
Do not overcomplicate automated semantic detection initially.
Manual collection creation with smart fill is acceptable early.

---

## Phase 3 — Finalization Flow

### Goal
Provide a guided finishing stage that helps users add emotional richness and quality polish near the end.

### Deliverables
1. Add a `Finalize` project section.
2. Add finalization scans for:
   - missing moments
   - recurring collections now strong enough to suggest
   - strongest unused photos
   - cover and ending page improvements
   - visual balance issues

3. Add finalization suggestion type:
   - `type = finalization`

4. Add guided finalization flow with small steps:
   - missing moments
   - highlight collections
   - best unused photos
   - book polish

5. Add placeholder page / reserved spread support for collection memories.

### Acceptance criteria
- A mostly finished project can enter finalization.
- The app proposes optional additions and polish.
- The user can skip finalization and still proceed.

### Notes
This is a major product differentiator.
It also solves the problem of themes that become meaningful only near the end.

---

## Phase 4 — Privacy-Safe Person Features

### Goal
Enable high-value yearbook features like person-driven collections while protecting user trust.

### Deliverables
1. Add local person profile support.
2. Add on-device face clustering / person matching if feasible in chosen stack.
3. Add project entity profiles:
   - people
   - pets
   - possibly named themes

4. Add person-driven suggestions:
   - Leo Through the Year
   - Family Moments
   - Faces mosaic candidate pages

5. Add controls:
   - disable people recognition
   - remove a person profile
   - hide a person from suggestions

### Acceptance criteria
- Person-based collections work without raw identity needing to leave the private layer.
- Users have clear privacy controls.

### Notes
Do not let this phase delay earlier product value.
This is powerful, but complexity is high.

---

## Phase 5 — Collaboration v1

### Goal
Allow low-complexity shared contribution.

### Deliverables
1. Add project invitations.
2. Add simple role model:
   - owner
   - contributor

3. Sync:
   - project metadata
   - memories
   - added photos
   - accepted suggestion states

4. Add owner moderation where needed for contributed photos.

### Acceptance criteria
- A contributor can add photos to a project.
- The owner can see and use contributed content.
- Editing authority remains with the owner.

### Notes
Do not attempt live collaborative layout editing in v1.

---

## Phase 6 — Design Personalization & Decorative Assistance

### Goal
Improve emotional quality without breaking tasteful defaults.

### Deliverables
1. Add style intensity settings if not already complete:
   - Minimal
   - Warm
   - Playful
   - Expressive

2. Add memory-level style overrides.
3. Add generalized tag-driven decorative suggestions:
   - borders
   - accents
   - stickers
   - background cues

4. Add explicit “generate sticker” or similar optional prompt-based decoration.
5. Add preview-before-apply on all generated decorations.

### Acceptance criteria
- Decoration remains subtle by default.
- Users can opt into more expression when desired.

---

## Phase 7 — Ordering & Commerce

### Goal
Make the product commercially complete.

### Deliverables
1. Add print spec handling.
2. Add book option selection:
   - size
   - page count
   - paper/cover options as needed

3. Add checkout flow.
4. Add shipping flow.
5. Add reorder path.

### Acceptance criteria
- A finished book can be ordered end-to-end in-app.

### Notes
This is not early priority, but domain assumptions should keep this future-compatible.

---

## Milestone Recommendation

### Milestone 1
Smart setup + event suggestions

### Milestone 2
Collections + watching

### Milestone 3
Finalization

These three milestones alone create a strong product foundation.

---

## Suggested Implementation Order for Current Repo

1. Extend types and storage models.
2. Add migrations for new project and memory fields.
3. Introduce `Suggestion` domain objects.
4. Update `AppContext` to manage suggestions and memory conversion.
5. Add project-level Suggestions UI.
6. Add project creation flow updates for timeline and assist settings.
7. Add retroactive scanning.
8. Refactor prompt engine into broader suggestion engine.
9. Add collection support.
10. Add finalization.

---

## Suggested Technical Boundaries

### Local-only or privacy-sensitive
Prefer local-first for:
- person recognition
- child profile associations
- sensitive project identity metadata
- high-resolution photo analysis if feasible

### Safe-to-external
Potentially safe to externalize:
- generalized, non-identifying theme tags
- decorative generation prompts
- print/order operations
- sync metadata where properly secured

---

## Testing Strategy

### Unit tests
- clustering logic
- suggestion generation
- memory conversion
- migration safety
- layout selection

### Integration tests
- project creation with retro scan
- accept/dismiss suggestion flows
- memory creation from suggestion
- finalization flow

### UX validation tests
Run scenario tests for:
- yearbook parent
- vacation traveler
- privacy-sensitive parent
- contributor adds photos to owner project

---

## Risks

### Product risks
- over-suggesting
- confusing event vs collection behavior
- privacy ambiguity
- noisy finalization flow

### Technical risks
- storage migrations
- performance of repeated scanning
- too much logic inside UI components
- over-coupling suggestion engine to render/editor code

---

## Recommended Immediate Next Tasks

1. Add new domain types and migration plan.
2. Convert prompt-engine outputs into `Suggestion` objects.
3. Add project-scoped Suggestions screen.
4. Add project setup fields for timeline and assist level.
5. Add retroactive scan entry point.
6. Add simple manual collection memory type before automating more collection detection.
7. Stub finalization screen early.

This order creates product momentum while keeping implementation stable.