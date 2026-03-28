# Milestone 2 Task Prompts

## Purpose

This file contains copy-paste prompts for Codex in VS Code for:

**Milestone 2 — Project photo intake, collections, and watching**

Use these prompts in order.
Do not skip ahead unless the current task is complete, reviewed, and committed.

Each prompt explicitly points Codex to the core planning documents and the matching task in:
- `docs/codex/active_work_plan_milestone_2.md`

This is intentional. Do not assume Codex will retain prior session context.

---

## Shared instruction pattern

Every task below:
- points Codex to the core docs
- points Codex to the matching task in `docs/codex/active_work_plan_milestone_2.md`
- identifies the code files to inspect
- states constraints and out-of-scope items
- asks for a bounded result

Use these prompts as written, then review each diff carefully.

---

## Task 1 — Introduce project-scoped photo intake and candidate pool

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 1 — Introduce project-scoped photo intake and candidate pool**

Then read these code files:
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`
- any files that currently define photo ownership or memory/photo relationships
- any relevant project detail or project creation files if needed for understanding

Design and implement the smallest safe additive change that introduces a project-scoped photo pool.

Requirements:
- a project must be able to have photos in scope that are not yet assigned to any memory
- preserve the existing memory-owned photo relationship and current editor/preview/export behavior
- persist the new project-scoped photo pool in a migration-safe way
- keep the implementation local-first
- make the new structure usable later for:
  - retroactive project scans
  - ongoing project suggestions
  - manual collection creation
  - candidate photo additions to memories

Constraints:
- do not redesign the entire photo architecture
- do not implement collection logic yet
- do not implement finalization logic yet
- do not add heavy background indexing/watchers yet
- do not add broad UI in this task unless a tiny scaffold is strictly needed
- prefer minimal additive types and AppContext support
- preserve backward compatibility for existing stored data

After editing, provide:
1. the data model change used for the project photo pool
2. how it is persisted and normalized
3. how it coexists with existing memory-owned photo relationships
4. any important follow-up limitations for Task 2

### What to review
- Can a project now contain photos that are not attached to a memory?
- Is this additive rather than a rewrite?
- Were editor/preview/export flows left alone?
- Is there a clean path for suggestion scans to use the new pool next?

---

## Task 2 — Generate event suggestions from the project photo pool

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 2 — Generate event suggestions from the project photo pool**

Then read these code files:
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- `src/types.ts`
- `src/storage.ts`
- any files that define photo ownership, project photo queries, or suggestion scan behavior

Using the new Milestone 2 project photo pool, update the event suggestion-generation path so project scans can use project-scoped photos that are not yet assigned to memories.

Requirements:
- update the retroactive / project suggestion scan path to include:
  - unassigned project photos
  - assigned memory photos
  - or both, as appropriate
- preserve the current local-first architecture
- preserve the existing suggestion upsert/reconciliation behavior
- keep suggestion generation side-effect free until user actions accept/dismiss/snooze them
- continue supporting project date-range scoping
- keep the implementation additive and minimal
- support Milestone 2’s core product rule: the app may scan all photos explicitly included in a project’s scope

Constraints:
- do not add collection logic yet
- do not add finalization logic yet
- do not redesign the photo architecture
- do not add heavy background indexing/watchers yet
- do not add broad UI in this task
- do not silently create memories from scan results
- do not break existing memory/editor/preview/export behavior
- preserve compatibility with Milestone 1 suggestion actions and UI
- keep repeated scans reconciling by suggestion ID rather than appending duplicates

Important guidance:
- prefer reusing the existing `generateSuggestionsForProject(...)` path and AppContext scan flow rather than inventing a new parallel system
- if suggestion generation currently assumes memory-linked photos, adapt it minimally so project-scoped unassigned photos can still participate in event suggestions
- it is acceptable in this task to make the suggestion generation path work on project-scoped photo groupings even if the grouping is simpler than the future ideal
- do not over-engineer a full raw-library intelligence system yet

After editing, provide:
1. how the scan path now includes project-scoped unassigned photos
2. whether assigned memory photos are still included, and how
3. how suggestion IDs/reconciliation behave across repeated scans
4. the current limitations of event suggestions from the project photo pool
5. what the next clean step would be for making this more user-visible

### What to review
- Does the scan now use project-scoped photos, not just memory photos?
- Are repeated scans reconciled via `upsertSuggestions(...)`?
- Was the change kept side-effect free?
- Did it avoid sneaking in collection logic?

---

## Task 3 — Add manual project photo intake flow

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 3 — Add manual project photo intake flow**

Then read these code files:
- `app/project/[id].tsx`
- any existing photo picker / image import flows
- `src/context/AppContext.tsx`
- `src/types.ts`
- any project detail or memory detail screens that currently add photos

Add a simple user flow to let users add photos to a project-scoped photo pool without immediately assigning them to a memory.

Requirements:
- the user must be able to add/import photos directly to a project
- those photos should become part of the project photo pool
- those photos should remain unassigned to memories until explicitly used
- keep the UX simple and consistent with the current app
- make the feature testable from the project screen

Constraints:
- do not force immediate memory creation
- do not redesign the app’s full photo management UI
- do not add collection logic yet
- do not add finalization UI
- do not break the current flow for adding photos directly to memories
- keep this local-first and migration-safe

Helpful directions:
- a simple “Add Photos to Project” button on the project screen is acceptable for this task
- basic confirmation or count feedback is acceptable
- keep visual scope small

After editing, provide:
1. where the project photo intake UI lives
2. how photos are added to the project pool without memory assignment
3. how this coexists with existing memory photo-add flows
4. any limitations or temporary UX shortcuts

### What to review
- Can the user now add photos to a project without creating a memory?
- Do those photos remain unassigned?
- Was the feature added with minimal UI scope?
- Did it preserve the existing memory-photo flow?

---

## Task 4 — Add ongoing project intake behavior

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 4 — Add ongoing project intake behavior**

Then read these code files:
- `src/context/AppContext.tsx`
- project creation / edit screens
- project detail screens
- any photo intake or scanning helpers
- `src/types.ts`

Add a simple, user-controlled ongoing project intake behavior so ongoing or hybrid projects can consider newly added project-scoped photos in future scans.

Requirements:
- ongoing and hybrid projects should be able to include future project-scoped photos in suggestion scans
- the behavior should be understandable and controllable
- preserve project boundary and user control
- keep the implementation lightweight for Milestone 2

Constraints:
- do not build a heavy background watcher or background indexing system yet
- do not silently expand project scope outside user-defined project boundaries
- do not add collection logic yet
- do not redesign project settings broadly
- a simple manual or semi-manual ongoing scan path is acceptable for this milestone

Helpful directions:
- a project-level toggle or setting is acceptable if needed
- a simple “include future photos in this project” option is acceptable
- a manual re-scan path is still acceptable if the architecture is not ready for automatic triggers

After editing, provide:
1. what ongoing intake behavior was added
2. how users control it
3. how future/new project-scoped photos become eligible for suggestions
4. what remains manual or simplified for now

### What to review
- Is ongoing intake still user-controlled?
- Does it avoid uncontrolled library scanning?
- Is it lightweight rather than over-engineered?
- Does it create a clean bridge to future suggestion refreshes?

---

## Task 5 — Add collection memory support

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 5 — Add collection memory support**

Then read these code files:
- `src/types.ts`
- `src/context/AppContext.tsx`
- memory creation / edit screens
- project detail screens
- any memory list / memory card components

Add collection memories as a first-class memory type.

Requirements:
- support `Memory.kind = collection`
- allow creation of a collection memory
- keep event memory behavior intact
- make collection memories distinguishable in data and basic UI
- keep the implementation simple and additive

Constraints:
- do not over-automate collection detection yet
- do not add watching state yet
- do not add finalization logic yet
- do not redesign all memory editing UI
- preserve existing event-memory behavior and editor flow

Helpful directions:
- a simple manual collection creation flow is acceptable
- collection memories do not need advanced matching logic in this task
- basic labels / badges in memory lists are acceptable

After editing, provide:
1. how collection memories are represented in the model and AppContext
2. how users create them
3. how collection memories are presented differently from event memories
4. what was intentionally deferred to later tasks

### What to review
- Can the app now represent collection memories cleanly?
- Did this avoid breaking event memories?
- Is the feature useful even before smart fill is added?
- Was the change additive rather than invasive?

---

## Task 6 — Add watching state for collection suggestions

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 6 — Add watching state for collection suggestions**

Then read these code files:
- project suggestions UI
- `src/context/AppContext.tsx`
- `src/types.ts`
- any suggestion presentation components
- any memory creation flows that might interact with suggestions

Add a lightweight watching state so collection-type suggestions can remain staged before becoming full memories.

Requirements:
- support a “watching” lifecycle for collection suggestions
- allow the user to keep watching a collection suggestion instead of accepting or dismissing it
- keep the UX lightweight and understandable
- preserve current event-suggestion behavior

Constraints:
- do not add finalization UI yet
- do not clutter the project screen excessively
- do not overbuild suggestion management UI
- do not require advanced AI detection in this task
- preserve Milestone 1 event suggestion flows

Helpful directions:
- a basic status or separate subsection is acceptable
- a “Keep Watching” action is sufficient
- it is acceptable to keep watching behavior mostly stateful/scaffolded first

After editing, provide:
1. how watching state is represented
2. how users move a collection suggestion into watching
3. how watched items are shown or filtered in the UI
4. what remains intentionally simple for now

### What to review
- Is watching clearly distinct from accept/dismiss/snooze?
- Does it feel lightweight?
- Did it preserve event-suggestion behavior?
- Is it useful without overcomplicating the screen?

---

## Task 7 — Add manual collection creation with smart fill hooks

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 7 — Add manual collection creation with smart fill hooks**

Then read these code files:
- collection memory creation / editing flows
- `src/context/AppContext.tsx`
- `src/types.ts`
- project photo pool query helpers
- any suggestion or photo selection helpers

Let users create a collection memory directly and add simple smart-fill hooks so the system can propose matching photos from the project pool.

Requirements:
- user can manually create a collection memory
- user can define simple hooks such as title, theme, tags, or prompt-like cues
- system can propose matching project-scoped photos for the collection
- user remains in control of actual inclusion
- keep the first version simple and useful

Constraints:
- do not require advanced AI to make this useful
- do not add person recognition yet
- do not auto-add photos silently
- do not redesign the whole memory editor
- keep this additive and easy to review

Helpful directions:
- examples include Hiking, Pets, Family, Sunsets
- simple tag/theme-based matching is acceptable
- candidate lists or highlighted photos are acceptable

After editing, provide:
1. how manual collection creation works
2. what smart-fill hooks were added
3. how candidate photos are proposed without auto-adding
4. what future upgrades are still needed

### What to review
- Can users create useful collections manually?
- Are candidate matches shown without taking control away?
- Is this useful even without advanced recognition?
- Did it avoid premature complexity?

---

## Task 8 — Add candidate photo suggestions for existing memories

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- `docs/codex/active_work_plan_milestone_2.md` → **Task 8 — Add candidate photo suggestions for existing memories**

Then read these code files:
- `src/context/AppContext.tsx`
- project suggestion and memory screens
- memory editing flows
- project photo pool query helpers
- `src/types.ts`

Use the project photo pool to suggest candidate photo additions for existing memories.

Requirements:
- system can suggest photos from the project pool that may belong to an existing memory
- this should work for event memories first, and may support collections if it comes naturally from the implementation
- review must remain explicit; do not silently add photos
- preserve current memory editing behavior
- keep the implementation simple and testable

Constraints:
- do not add finalization logic yet
- do not overbuild ranking or AI scoring
- do not auto-modify memories from suggestion generation
- do not redesign the entire editor
- keep suggestion actions understandable

Helpful directions:
- examples:
  - “Add 4 more hiking photos”
  - “These 3 photos may belong to Beach Day”
- a simple candidate list or suggestion card is acceptable

After editing, provide:
1. how candidate photo suggestions are generated
2. where they are surfaced
3. how the user reviews and applies them
4. what remains limited or heuristic-based

### What to review
- Are existing memories now able to receive candidate photo suggestions?
- Is user review explicit?
- Did this avoid silent mutation?
- Is the implementation still bounded?

---

## Optional Task 9 — Add basic stabilization for project photo pool UX

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- Milestone 2 behavior implemented so far in `docs/codex/active_work_plan_milestone_2.md`

Then read these code files:
- project detail screens
- any project photo intake UI
- `src/context/AppContext.tsx`
- any shared empty/loading/error state helpers

Add lightweight stabilization and usability improvements for the new project photo pool and project suggestion flows.

Requirements:
- improve empty states for project photo intake / project suggestions
- add lightweight feedback for project photo additions
- improve scan feedback where useful
- keep changes small and aligned with Milestone 2

Constraints:
- do not redesign major screens
- do not add final polish or finalization logic
- do not add collection-specific complexity unless already present
- keep this a stabilization task, not a product redesign

After editing, provide:
1. what stabilization states or feedback were added
2. what UX remained intentionally lightweight
3. any rough edges that should be revisited later

---

## Optional Task 10 — Add focused tests for Milestone 2 foundations

**Status:** done

### Prompt
Before making any changes, read these documents for context:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_2.md`

Focus specifically on:
- the completed Milestone 2 tasks in `docs/codex/active_work_plan_milestone_2.md`
- the current project-photo-pool and collection/watch flows

Then read these code files:
- relevant test setup files
- `src/types.ts`
- `src/storage.ts`
- `src/context/AppContext.tsx`
- `src/services/promptEngine.ts`
- any new project photo pool helpers
- any files that implement collection memory creation, watching state, and candidate photo suggestions

Add focused tests for Milestone 2 foundational behavior only.

Priority areas:
1. project photo pool persistence and normalization
2. suggestion generation from project-scoped unassigned photos
3. repeated scan reconciliation / upsert behavior
4. manual project photo intake behavior
5. collection-memory data behavior
6. watching-state behavior for collection suggestions
7. candidate photo assignment into memories

Constraints:
- keep tests focused
- avoid broad test refactors
- do not add tests for future image-analysis/person-recognition/finalization logic yet
- prefer high-value tests over large test volume
- preserve existing test patterns in the repo
- if a behavior is currently heuristic-driven, test the stable contract rather than fragile implementation details

Helpful directions:
- prioritize AppContext and persistence behavior over UI snapshot tests
- it is acceptable to add a few small helper fixtures if that makes the tests clearer
- if some UI flow is difficult to test directly, test the underlying state transition or helper path instead

After editing, provide:
1. what is covered
2. what remains intentionally untested
3. any brittle areas or technical debt revealed by the tests
4. the most important remaining untested risks before Milestone 3

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
8. Task 8

Optional:
9. Task 9
10. Task 10

Do not move to Milestone 3 until the project photo pool and collection/watch flows are coherent enough in real usage.

---

## Review checklist after each Codex task

For every diff, verify:
- architecture is preserved
- change scope is controlled
- backward compatibility is safe
- no unrelated rewrites were introduced
- names match the product spec
- user control is preserved
- the next task becomes easier, not harder

---

## Reminder for the human operator

Before each new Codex task:
1. update `docs/codex/active_work_plan_milestone_2.md`
2. paste the next prompt
3. review the result carefully
4. test locally
5. commit
6. note what changed in the active work plan
