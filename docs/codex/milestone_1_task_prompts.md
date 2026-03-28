# Milestone 1 Task Prompts

## Purpose

This file contains copy-paste prompts for Codex in VS Code for:

**Milestone 1 — Smart setup + event suggestions**

Use these prompts in order.
Do not skip ahead unless the current task is complete, reviewed, and committed.

Each prompt explicitly points Codex to the core planning documents and the matching task in:
- `docs/codex/active_work_plan.md`

This is intentional. Do not assume Codex will retain prior session context.

---

## Shared instruction pattern

Every task below:
- points Codex to the core docs
- points Codex to the matching task in `docs/codex/active_work_plan.md`
- identifies the code files to inspect
- states constraints and out-of-scope items
- asks for a bounded result

Use these prompts as written, then review each diff carefully.

---

## Task 1 — Inspect current architecture

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Task 1 — Inspect the current architecture and identify the minimal implementation path for Milestone 1 domain changes**

Then read these code files:
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- any project creation screen
- any project detail screen
- any prompt center or suggestion-related screen

Then do the following:
1. Summarize the current domain model for Project, Memory, pages, and prompt/suggestion-like concepts.
2. Summarize the current persistence/storage approach and where migration/defaulting needs to happen.
3. Identify the minimal set of files to change to support Milestone 1.
4. Propose the smallest safe implementation order for adding:
   - `Project.projectType`
   - `Project.timelineMode`
   - `Project.startDate`
   - `Project.endDate`
   - `Project.assistLevel`
   - `Project.styleIntensity`
   - `Memory.kind`
   - `Memory.status`
   - `Suggestion`
5. Identify backward compatibility and migration risks.

Constraints:
- do not edit code yet
- keep the response file-specific
- preserve the current local-first architecture
- do not propose a broad rewrite

Return:
- a concise architecture summary
- a minimal file-by-file implementation plan
- migration/backward compatibility risks

### What to review
- Did Codex actually inspect the right boundaries?
- Did it preserve the existing architecture?
- Did it avoid proposing a rewrite?

---

## Task 2 — Add domain types and migration scaffolding

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Task 2 — Add domain types and migration scaffolding**

Then read these code files:
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`

Using the inspected architecture and the project docs, implement only the Milestone 1 domain type additions and storage/migration scaffolding.

Add support for:
- `Project.projectType` (preserve existing stored values; do not destructively rename legacy values)
- `Project.timelineMode`
- `Project.startDate`
- `Project.endDate`
- `Project.assistLevel`
- `Project.styleIntensity`
- `Memory.kind`
- `Memory.status`
- a minimal `Suggestion` type
- persisted `suggestions` support in app storage

Constraints:
- preserve the current local-first storage approach
- keep backward compatibility for existing saved data
- use migration-safe defaults
- keep `Suggestion` minimal for Milestone 1
- do not add UI yet
- do not refactor unrelated code
- do not implement suggestion actions yet
- do not refactor `promptEngine` yet
- avoid destructive changes to existing `projectType` values
- only widen function signatures if required for safe type integration

After making changes, provide:
1. a summary of changed files
2. migration/default assumptions
3. any follow-up risks
### What to review
- Are the types explicit and minimal?
- Are defaults safe for older saved data?
- Did Codex avoid unrelated changes?

---

## Task 3 — Add suggestion state handling to AppContext

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Task 3 — Add suggestion state handling to AppContext**

Then read these code files:
- `src/context/AppContext.tsx`
- `src/types.ts`
- `src/storage.ts`
- any existing memory creation helpers or project state helpers

Implement minimal support for project-scoped suggestion state and actions in AppContext.

Requirements:
- store and query suggestions by project
- support suggestion state transitions:
  - accept
  - dismiss
  - snooze
- accepting an event suggestion should create or seed a memory using the existing memory creation flow as much as possible
- preserve current manual memory creation behavior
- keep accepted suggestions persisted with explicit status rather than silently deleting them unless existing patterns strongly require otherwise

Constraints:
- do not add UI yet
- do not deeply rewrite `AppContext`
- keep new actions explicit and easy to test
- do not introduce collection logic yet
- avoid duplicating memory creation logic
- do not refactor `promptEngine` yet
- do not add retroactive scanning yet
- do not generate pages/layouts from accepted suggestions in this task

After editing, provide:
1. a summary of the new AppContext surface area
2. how accepted suggestions become memories or memory seeds
3. assumptions or temporary limitations
### What to review
- Did Codex keep canonical memory logic in AppContext?
- Did it avoid duplicating creation paths?
- Is the state shape future-friendly without being overbuilt?

---

## Task 4 — Refactor prompt engine output into Suggestion objects

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Task 4 — Refactor prompt engine output into Suggestion objects**

Then read these code files:
- `src/services/promptEngine.ts`
- `src/types.ts`
- `src/context/AppContext.tsx`
- any relevant project/photo helper files if needed

Refactor the current prompt engine so it can produce project-scoped `Suggestion` objects for Milestone 1 event suggestions.

Requirements:
- reuse the existing burst/time/location logic where possible
- add a project-scoped suggestion-generation path, such as `generateSuggestionsForProject(...)`, without forcing a destructive replacement of existing prompt behavior yet
- output `Suggestion` objects instead of standalone prompt-like items for the new path
- include human-readable explanation strings for why each suggestion exists
- support only event suggestions in this task
- include candidate photo ids if they are available from the current signal logic
- keep the engine side-effect free with respect to projects, memories, and storage

Constraints:
- do not add advanced collection logic yet
- do not directly mutate memory state from the engine
- do not build a background job system yet
- do not add UI in this task
- keep logic readable and modular
- preserve existing signal logic where practical
- do not break the existing global prompt flow unless there is a very small compatibility change required

After editing, provide:
1. how the old prompt output maps to the new Suggestion model
2. what signal logic was reused vs added
3. current limitations of the event suggestion generation
4. clean extension points for future collection support
### What to review
- Did Codex preserve useful existing logic?
- Are explanations exposed in the returned data?
- Is the engine still decoupled from UI and memory mutation?

---

## Task 5 — Extend project setup for smart projects

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Task 5 — Extend project setup for smart projects**

Then read these code files:
- project creation screen(s), especially `app/index.tsx`
- `src/types.ts`
- `src/context/AppContext.tsx`
- any relevant project form or navigation files

Update the project creation flow to support these Milestone 1 fields:
- `projectType`
- `timelineMode`
- `startDate`
- `endDate`
- `assistLevel`
- `styleIntensity`

Requirements:
- support initial project types:
  - Yearbook
  - Vacation
- support timeline modes:
  - ongoing
  - past
  - hybrid
- keep the setup UX simple and phone-first
- store the new values correctly
- preserve existing project creation behavior for legacy/general flows where needed

Constraints:
- do not add advanced privacy controls yet
- do not add collaboration setup yet
- avoid over-complicating the first-run experience
- do not trigger retroactive scans in this task
- do not add suggestion UI in this task
- do not refactor unrelated navigation
- avoid destructive changes to legacy `projectType` handling

After editing, provide:
1. a summary of the updated setup flow
2. how defaults work
3. any UX simplifications used for Milestone 1
4. any follow-up issues created by legacy vs new `projectType` values
### What to review
- Is setup still simple?
- Is it clearly optimized for Yearbook and Vacation first?
- Did Codex avoid adding too many settings?

---

## Task 6 — Add retroactive scan entry point

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Task 6 — Add retroactive scan entry point**

Then read these code files:
- project creation / project detail files
- `src/services/promptEngine.ts`
- `src/context/AppContext.tsx`
- any project scanning or photo loading helpers
- `src/types.ts`

Using the current project model and the updated suggestion engine, add a retroactive scan entry point for projects with a past or hybrid timeline.

Requirements:
- the scan should generate project-scoped event suggestions from photos or memories in the project’s current scope
- use the project’s stored date range when available
- keep the implementation simple for Milestone 1
- the project should remain usable even if scan fails or is partial
- the scan should not silently create memories
- generated suggestions should be persisted through the existing AppContext suggestion path

Constraints:
- do not build a heavy background-job system yet
- synchronous or manually triggered behavior is acceptable if clean
- do not add collection scanning in this task
- do not add suggestion UI in this task
- do not refactor the prompt engine beyond what is strictly necessary
- do not broaden this into a full unassigned-library scan unless the existing code already supports that easily
- keep failure handling safe and non-destructive

After editing, provide:
1. where the scan entry point lives
2. how date scoping works
3. how generated suggestions are persisted/upserted
4. current limitations of the scan
### What to review
- Is the scan entry point easy to reason about?
- Does it respect project date ranges?
- Does it avoid hidden mutations?

---

## Task 7 — Add project-scoped Suggestions UI scaffold

##prompt

Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Task 7 — Add project-scoped Suggestions UI scaffold**

Then read these code files:
- project detail / project tabs screens, especially `app/project/[id].tsx`
- any existing prompt center or list UI
- `src/context/AppContext.tsx`
- `src/types.ts`

Create a simple project-scoped Suggestions UI scaffold for Milestone 1.

Requirements:
- show event suggestions for the current project
- display:
  - suggestion title
  - explanation / why suggested
  - candidate photo count if available
  - status if useful for debugging/scaffolding
- actions:
  - accept
  - dismiss
  - snooze
- actions should use the AppContext suggestion actions
- if helpful, include a simple manual “scan suggestions” trigger on the project screen for Milestone 1 testing

Constraints:
- keep the UI simple and functional
- preserve existing navigation patterns
- do not add collection UI yet
- do not implement polished final UX in this task
- do not add finalization UI yet
- do not redesign the project screen broadly
- do not reintroduce a global-only suggestion model

After editing, provide:
1. the new UI entry point and screen structure
2. how actions connect to AppContext
3. what is intentionally stubbed or simplified
4. any temporary testing affordances added, like a manual scan button

### What to review
- Is the screen project-scoped rather than global?
- Does it feel like a scaffold rather than an accidental final design?
- Do the actions work cleanly?

---

## Optional Task 8 — Add basic empty/loading/error states for Suggestions

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- `docs/codex/active_work_plan.md` → **Optional Task 8 — Add basic empty/loading/error states for Suggestions**

Then read these code files:
- `app/project/[id].tsx`
- `src/context/AppContext.tsx`
- any existing loading/error/empty-state UI helpers already used in the app

Improve the Milestone 1 project-scoped Suggestions scaffold by adding basic state handling and making the suggestion lifecycle easier to understand during testing.

Requirements:
- keep the Suggestions section visible and understandable when there are no suggestions
- add a clearer empty state message
- add a loading state for the manual scan flow if the current structure supports it
- add a clearer failure/fallback state if scan generation fails
- make accepted, snoozed, and dismissed suggestions easier to understand in the scaffold
- preserve the existing manual “Scan Suggestions” testing affordance
- keep the implementation simple and aligned with Milestone 1

Constraints:
- do not redesign the project screen
- do not add collection-specific language yet
- do not add finalization UI
- do not create a full dedicated suggestions screen
- do not introduce broad styling refactors
- do not change core suggestion generation or storage behavior unless strictly necessary for state display
- keep this as a scaffold/stabilization task, not polished final UX

Helpful directions:
- It is acceptable to group or visually separate suggestions by status if that is the simplest way to improve clarity.
- It is acceptable to hide dismissed suggestions by default if that reduces clutter, as long as the behavior stays understandable for testing.
- Prefer small explicit UI states over a large redesign.

After editing, provide:
1. what empty/loading/error states were added
2. how accepted/snoozed/dismissed suggestions are now presented
3. any temporary Milestone 1 testing-oriented UI choices
4. any assumptions or limitations that should be revisited in Milestone 2

---

## Optional Task 9 — Add tests for Milestone 1 core logic

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

Focus specifically on:
- Milestone 1 definition of done in `docs/codex/active_work_plan.md`

Then read these code files:
- relevant test setup files
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`

Add targeted tests for Milestone 1 logic only.

Priority areas:
- migration/default behavior for new fields
- Suggestion creation from prompt-engine logic
- AppContext suggestion actions:
  - accept
  - dismiss
  - snooze
- conversion of accepted event suggestion into memory seed state if practical

Constraints:
- keep tests focused
- avoid broad test refactors
- do not add tests for future collection/finalization logic yet

After editing, provide:
1. what is covered
2. notable gaps
3. the most important remaining untested risks

---

## Recommended execution sequence

Run these in order:
1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7

Optional:
8. Task 8
9. Task 9

Do not move to Milestone 2 until Milestone 1 is working end-to-end.

---

## Review checklist after each Codex task

For every diff, verify:
- architecture is preserved
- change scope is controlled
- backward compatibility is safe
- no unrelated rewrites were introduced
- names match the product spec
- the next task becomes easier, not harder

---

## Reminder for the human operator

Before each new Codex task:
1. update `docs/codex/active_work_plan.md`
2. paste the next prompt
3. review the result carefully
4. test locally
5. commit
6. note what changed in the active work plan