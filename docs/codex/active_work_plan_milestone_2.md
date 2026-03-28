# Active Work Plan — Milestone 2

## Project
Photobook app — memory-based, privacy-centric, low-effort photobook creation

## Milestone
Milestone 2 — Project photo intake, collections, and watching

## Milestone goal
Expand the system from memory-owned suggestion input to true project-scoped suggestion input.

Milestone 2 should enable:
- project-scoped photo intake beyond existing memories
- event suggestions from unassigned project photos
- collection memories
- watching state for evolving collections
- candidate photo additions to existing memories

This milestone should make the app feel much closer to the intended product:
- past projects can scan a full chosen range
- ongoing projects can surface suggestions from newly relevant photos
- collections can emerge over time

---

## Core product rule for this milestone
The app may scan all photos that the user has explicitly included in a project’s scope.

This means:
- not only photos already attached to memories
- not uncontrolled full-library scanning
- project-scoped intake only

Project scope may be defined by:
- selected photos
- project date range
- future ongoing photo intake
- contributor uploads

---

## Milestone 2 tasks

### Task 1 — Introduce project-scoped photo intake and candidate pool
**Status:** not started

#### Goal
Add a project-level photo pool so suggestions can be generated from project-scoped photos that are not yet attached to memories.

#### Scope
Introduce a project-scoped concept for photos that belong to the project but are not necessarily assigned to a memory yet.

This may be represented as:
- `projectPhotoIds`
- project photo membership records
- or another minimal structure aligned with the current architecture

#### Constraints
- preserve the current local-first architecture
- do not redesign the whole photo model
- keep memory ownership working
- do not yet implement broad library watchers/background indexing if the architecture does not support it cleanly
- prefer a minimal additive model

#### Definition of done
- a project can have photos in scope that are not yet assigned to memories
- the project-scoped photo pool is persisted
- existing memory/photo flows still work

---

### Task 2 — Generate event suggestions from the project photo pool
**Status:** not started

#### Goal
Make retroactive and ongoing project suggestions use project-scoped photos, not just memory-owned photos.

#### Scope
Update the suggestion-generation entry path so it can use:
- unassigned project photos
- assigned memory photos
- or both

#### Constraints
- reuse current Milestone 1 suggestion engine where practical
- do not add collection logic yet
- keep suggestions side-effect free until accepted
- preserve upsert/reconciliation behavior

#### Definition of done
- a past project can generate event suggestions from in-scope project photos even if they are not already in memories
- repeated scans reconcile suggestions instead of duplicating them

---

### Task 3 — Add manual project photo intake flow
**Status:** done

#### Goal
Let users explicitly add photos to a project pool without immediately assigning them to memories.

#### Scope
Add a simple user flow to:
- add/import photos to the project
- view project photo count
- keep those photos available for suggestions and later memory assignment

#### Constraints
- keep UX simple
- do not build a complex asset management UI yet
- do not force immediate memory creation

#### Definition of done
- user can add photos to a project without creating a memory first
- those photos become eligible for future suggestions

---

### Task 4 — Add ongoing project intake behavior
**Status:** done

#### Goal
Allow ongoing or hybrid projects to consider newly added/taken photos within project scope.

#### Scope
Support a simple ongoing-intake model for projects where future photos should be eligible for suggestion generation.

#### Constraints
- keep this user-controlled
- do not silently expand scope outside the project definition
- avoid heavy background-job systems unless already easy to support

#### Definition of done
- an ongoing project can include new in-scope photos in future scans
- this behavior is understandable and controllable

---

### Task 5 — Add collection memory support
**Status:** done

#### Goal
Support collection memories as a first-class memory type.

#### Scope
Add:
- `Memory.kind = collection`
- collection creation flow
- collection-specific metadata
- simple collection memory presentation

#### Constraints
- keep event memory behavior intact
- do not over-automate collection detection yet
- keep the first version simple

#### Definition of done
- a project can contain collection memories
- collection memories are distinct from event memories in data and UI

---

### Task 6 — Add watching state for collection suggestions
**Status:** done

#### Goal
Allow collection-type suggestions to exist in a staged state before being promoted to real memories.

#### Scope
Add:
- watching state
- keep watching action
- collection suggestion presentation

#### Constraints
- keep the experience lightweight
- do not add finalization yet
- avoid cluttering the main suggestions list excessively

#### Definition of done
- a collection suggestion can be kept in watching state
- watched items can accumulate value over time

---

### Task 7 — Add manual collection creation with smart fill hooks
**Status:** done

#### Goal
Let users create a collection memory directly and have the system help populate it.

#### Scope
Examples:
- Leo Through the Year
- Pets
- Hiking
- Family
- Sunsets

#### Constraints
- do not require advanced AI to make this useful
- allow manual tags/themes as hooks
- keep user control explicit

#### Definition of done
- user can create a collection manually
- the system can propose matching photos for that collection

---

### Task 8 — Add candidate photo suggestions for existing memories
**Status:** done

#### Goal
Use the broader project pool to suggest photo additions to current memories.

#### Scope
Examples:
- “Add 4 more hiking photos”
- “These 3 photos may belong to Beach Day”

#### Constraints
- do not silently add photos
- keep review explicit
- do not mix collection and event logic too aggressively at first

#### Definition of done
- existing memories can receive candidate photo suggestions from the project pool

---

## Out of scope for this milestone
Do not implement yet:
- person recognition / face clustering
- finalization flow
- commerce
- full collaboration sync beyond simple project contribution support if already present
- heavy background indexing infrastructure unless clearly needed

---

## Recommended execution order
1. Task 1 — project-scoped photo intake and candidate pool
2. Task 2 — event suggestions from project photo pool
3. Task 3 — manual project photo intake
4. Task 4 — ongoing project intake behavior
5. Task 5 — collection memory support
6. Task 6 — watching state
7. Task 7 — manual collection creation with smart fill hooks
8. Task 8 — candidate photo additions to existing memories
