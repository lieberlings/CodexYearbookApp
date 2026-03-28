# Active Work Plan

## Project
Photobook app — memory-based, privacy-centric, low-effort photobook creation

## Current product focus
Initial target project types:
- Yearbook
- Vacation

Core experience priorities:
1. Lowest effort
2. Privacy
3. Strong design

Core content model:
- Event memories
- Collection memories
- Finalization phase for missing moments, recurring collections, and polish

---

## Current milestone
Milestone 1 — Smart setup + event suggestions

## Milestone goal
Turn the existing app into a project-scoped, suggestion-driven photobook builder without disrupting the current editing, preview, and export flows.

This milestone should establish the domain and UX foundation for:
- project timeline setup
- project-scoped suggestions
- retroactive scan for past projects
- event memory suggestions
- user-controlled accept / dismiss / snooze actions

This milestone should **not** try to solve:
- advanced collection intelligence
- person recognition
- collaboration sync
- ordering / commerce
- full finalization logic

---

## Core documents for every Codex task
Before each substantial Codex task, point Codex to:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

---

## Milestone 1 tasks

### Task 1 — Inspect current architecture
**Status:** done
#### Goal
Understand the current architecture and identify the minimal implementation path for Milestone 1 domain changes.

#### Scope
Identify where and how to add:
- `Project.projectType`
- `Project.timelineMode`
- `Project.startDate`
- `Project.endDate`
- `Project.assistLevel`
- `Project.styleIntensity`
- `Memory.kind`
- `Memory.status`
- `Suggestion`

#### Files Codex should inspect first
- `ARCHITECTURE.md`
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- any project creation screen
- any project detail screen
- any prompt center or suggestion-related screen

#### Constraints
- preserve the current local-first storage model
- preserve existing project, memory, page, and export flows
- avoid UI changes during this task
- prefer migration-safe defaults
- do not rewrite `AppContext`
- do not replace the current prompt engine yet; only prepare for extension

#### Definition of done
- the relevant architecture is summarized clearly
- the minimal file set to change is identified
- a migration-safe implementation order is proposed
- no code changes yet

---

### Task 2 — Add domain types and migration scaffolding
**Status:** complete

#### Goal
Add the Milestone 1 domain types and persistence support needed for suggestion-driven project workflows.

#### Scope
Implement support for:
- `Project.projectType`
- `Project.timelineMode`
- `Project.startDate`
- `Project.endDate`
- `Project.assistLevel`
- `Project.styleIntensity`
- `Memory.kind`
- `Memory.status`
- `Suggestion`

#### Constraints
- no UI changes yet
- keep defaults safe for existing stored data
- keep naming aligned with the product docs
- do not over-design `Suggestion`; keep it minimal for Milestone 1
- preserve the current local-first model
- avoid unrelated refactors

#### Files likely involved
- `src/types.ts`
- `src/storage.ts`
- any migration helpers
- `src/context/AppContext.tsx` if type wiring is required

#### Definition of done
- types are updated
- migration or default handling exists
- old data can still load safely
- the app compiles
- no existing project data breaks

---

### Task 3 — Add suggestion state handling to AppContext
**Status:** done

#### Goal
Add minimal project-scoped suggestion state and actions to the central app data boundary.

#### Scope
Support:
- storing suggestions by project
- suggestion state transitions:
  - accept
  - dismiss
  - snooze
- creating or seeding a memory from an accepted event suggestion

#### Constraints
- preserve current manual memory creation behavior
- do not add UI yet
- do not deeply rewrite `AppContext`
- keep new actions explicit and testable
- do not introduce collection logic yet
- avoid duplicating memory creation logic

#### Files likely involved
- `src/context/AppContext.tsx`
- `src/types.ts`
- `src/storage.ts`
- any memory creation helpers or project state helpers

#### Definition of done
- suggestions can exist in app state
- suggestion actions exist in `AppContext`
- accepting an event suggestion can create or seed a memory
- current editor and manual flows still work

---

### Task 4 — Refactor prompt engine output into Suggestion objects
**Status:** done
#### Goal
Convert the current prompt engine into a Milestone 1 event suggestion engine without changing its underlying purpose too aggressively.

#### Scope
Refactor current prompt-like outputs so they become project-scoped `Suggestion` objects.

Initial supported suggestion type:
- `event`

Initial signal sources:
- burst / time clustering
- location changes
- photo spikes

#### Constraints
- do not introduce advanced semantic AI yet
- keep logic readable and modular
- include human-readable explanation strings
- avoid hidden mutation of projects or memories
- preserve existing signal logic where practical

#### Files likely involved
- `src/services/promptEngine.ts`
- `src/types.ts`
- `src/context/AppContext.tsx`
- any project scanning helpers if needed

#### Definition of done
- prompt engine outputs map to `Suggestion`
- suggestions include explanation strings
- suggestions can be generated for a project scan
- existing logic is preserved where reasonable
- no direct memory mutation happens inside the engine

---

### Task 5 — Extend project setup for smart projects
**Status:** done

#### Goal
Update project creation so users can create yearbook and vacation projects with smart setup fields.

#### Scope
Add support in the project creation flow for:
- `projectType`
- `timelineMode`
- `startDate`
- `endDate`
- `assistLevel`
- `styleIntensity`

Support initial project types:
- Yearbook
- Vacation

Support timeline modes:
- ongoing
- past
- hybrid

#### Constraints
- keep setup simple and phone-first
- do not add advanced privacy controls yet
- do not add collaboration setup yet
- avoid over-complicating the first-run experience
- preserve compatibility with existing project creation flows

#### Files likely involved
- project creation screen(s)
- relevant project form helpers
- `src/types.ts`
- `src/context/AppContext.tsx`

#### Definition of done
- user can create a project with the new fields
- values are stored correctly
- defaults are coherent
- setup remains simple

---

### Task 6 — Add retroactive scan entry point
**Status:** done

#### Goal
Add a project-scoped event suggestion scan for past and hybrid projects.

#### Scope
When a project is created or configured with a past or hybrid timeline:
- run a scoped event suggestion scan
- generate project-scoped suggestions from photos in range
- attach suggestions to the project

#### Constraints
- keep the implementation simple for Milestone 1
- do not build a heavy background job system yet
- synchronous or manually triggered behavior is acceptable if clean
- project must remain usable even if scan fails or is partial
- do not silently create memories
- do not add collection scanning yet

#### Files likely involved
- project creation / detail screens
- `src/services/promptEngine.ts`
- `src/context/AppContext.tsx`
- photo loading / scanning helpers
- `src/types.ts`

#### Definition of done
- a project can trigger a scoped suggestion scan
- date range filtering works
- generated suggestions are attached to the project
- failures degrade safely and do not break the project

---

### Task 7 — Add project-scoped Suggestions UI scaffold
**Status:** done
#### Goal
Add a simple project-level Suggestions surface for Milestone 1 event suggestions.

#### Scope
Show:
- event suggestions for the current project
- title
- explanation / why suggested
- candidate photo count if available

Actions:
- accept
- dismiss
- snooze

Actions should use the `AppContext` suggestion actions.

#### Constraints
- keep the UI simple and functional
- preserve existing navigation patterns
- do not add collection UI yet
- do not implement polished final UX in this task
- do not add finalization UI yet

#### Files likely involved
- project detail / project tabs screens
- any existing prompt center or list UI
- `src/context/AppContext.tsx`
- `src/types.ts`

#### Definition of done
- user can open a project-scoped Suggestions surface
- user can review event suggestions
- user can accept, dismiss, or snooze suggestions
- accepted suggestions flow into memory creation or memory seed flow

---

## Optional Milestone 1 tasks

### Optional Task 8 — Add basic empty/loading/error states for Suggestions
**Status:** in progress

#### Goal
Make the Milestone 1 Suggestions scaffold usable in normal edge cases.

#### Scope
Add:
- empty state when no suggestions exist
- loading state while a scan is in progress if such state exists
- error state or fallback message if scan generation fails

#### Constraints
- keep visuals simple
- do not redesign navigation
- do not add collection-specific language yet
- stay aligned with Milestone 1 only

#### Definition of done
- Suggestions screen handles empty state cleanly
- loading state is understandable
- scan failures degrade gracefully

---

### Optional Task 9 — Add tests for Milestone 1 core logic
**Status:** not selected
#### Goal
Add focused tests for the most important Milestone 1 behaviors.

#### Scope
Priority areas:
- migration / default behavior for new fields
- `Suggestion` creation from prompt-engine logic
- `AppContext` suggestion actions:
  - accept
  - dismiss
  - snooze
- accepted event suggestion converting into memory seed state if practical

#### Constraints
- keep tests focused
- avoid broad test refactors
- do not add tests for future collection/finalization logic yet

#### Definition of done
- core Milestone 1 behaviors have test coverage
- notable gaps are documented
- broad future-scope testing is avoided

---

## Current assumptions to preserve
- the app remains phone-first
- the product remains local-first
- existing preview / export / editor consistency is important
- smart features should guide, not decide
- Yearbook and Vacation are first-class product targets
- Finalization influences architecture now but is not part of Milestone 1 implementation scope

---

## Out of scope for Milestone 1
Do not implement yet:
- collection memory automation
- person recognition / face clustering
- contributor sync
- ordering / commerce
- decorative generation system
- full finalization wizard
- “more like this / less like this” learning controls

---

## Risks to watch during Milestone 1
- migration issues with stored project or memory data
- suggestion logic becoming too coupled to UI
- accidental duplication of memory creation logic
- project setup becoming too complex
- introducing “prompt” and “suggestion” concepts in parallel instead of consolidating

---

## Definition of done for Milestone 1
Milestone 1 is complete when:
- projects support smart setup fields
- users can create a yearbook or vacation project with a timeline
- a project can run a retroactive event scan
- event suggestions are visible at the project level
- suggestions can be accepted, dismissed, or snoozed
- accepting a suggestion can seed a memory
- current editing, preview, and export flows still work

---

## Recently completed
- product vision clarified:
  - event memories
  - collection memories
  - finalization phase
  - privacy-first posture
- roadmap defined for Milestones 1–3
- Codex workflow docs created
- Milestone 1 prompt sequence created

---

## Next milestone after Milestone 1
Milestone 2 — Collections + Watching

Likely first tasks:
1. add `Memory.kind = collection`
2. add collection memory creation flow
3. add watching state
4. add manual collection memories with smart fill hooks
5. add collection-specific suggestion support

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