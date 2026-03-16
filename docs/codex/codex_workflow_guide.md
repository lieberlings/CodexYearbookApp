# Codex Workflow Guide for This Repository

## Purpose

This guide explains how to use Codex in VS Code to implement the photobook roadmap continuously and smoothly without losing architectural coherence.

The repository should be treated as a living product system, not a series of disconnected patches.

---

## High-Level Strategy

Codex works best when:
- the product shape is explicit
- architectural constraints are documented
- tasks are scoped narrowly
- the current milestone is visible
- acceptance criteria are concrete

The goal is to make Codex an implementation partner, not an accidental re-designer of the system.

---

## Core Rules for Using Codex on This Project

### 1. Always give Codex architectural context
For every substantial task, point Codex to:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- the specific files it should inspect before changing anything

### 2. Keep tasks small and sequential
Do not ask Codex to implement an entire milestone in one prompt.
Break work into slices.

Good slices:
- add domain types
- add migration support
- refactor prompt engine output to suggestion objects
- create Suggestions screen scaffold
- wire accept/dismiss actions into AppContext

### 3. Require a plan before edits
For non-trivial changes, first ask Codex to:
- inspect relevant files
- summarize current behavior
- propose the minimal implementation approach
- identify migration or compatibility risks

Then ask it to make changes.

### 4. Preserve existing strengths
This repo already has important patterns worth protecting:
- local-first approach
- `AppContext` as central state boundary
- shared layout/render logic across editor/preview/export

Codex should extend these patterns, not work around them.

### 5. Prefer additive changes over broad rewrites
Ask for:
- targeted refactors
- migration-safe model extension
- compatibility-preserving APIs

Avoid asking for:
- “rewrite this feature”
- “re-architect everything”
- “replace state management wholesale”

---

## Recommended Repo Doc Structure

Store planning docs in-repo:

- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan.md`

### Why `active_work_plan.md` matters
This should be the current working memory for implementation.

It should contain:
- current milestone
- current task
- done recently
- next 3 tasks
- open risks/questions
- definition of done for the current slice

This file helps keep Codex aligned across sessions.

---

## Recommended Codex Session Pattern

## Step 1 — Inspect first
Before asking for edits, prompt Codex to inspect the relevant code and summarize.

Example:
“Read `ARCHITECTURE.md`, `src/types.ts`, `src/storage.ts`, and `src/context/AppContext.tsx`. Summarize the current domain model, persistence approach, and where to add support for `Memory.kind`, `Memory.status`, and a new `Suggestion` type. Do not edit yet.”

## Step 2 — Ask for implementation plan
Then ask for a minimal plan.

Example:
“Propose the smallest safe implementation plan for adding `Suggestion` objects and migration-safe support for new memory fields. Highlight backward compatibility concerns.”

## Step 3 — Execute one slice
Then ask for a single implementation slice.

Example:
“Implement only the type changes and storage migration scaffolding. Do not add UI yet. Keep the changes minimal and explain any assumptions.”

## Step 4 — Review diff quality
Check:
- did it preserve architecture?
- did it overreach?
- did it modify unrelated files?
- is migration safe?
- are types coherent?

## Step 5 — Move to next slice
Only after review, ask for the next slice.

---

## What to Put in `active_work_plan.md`

Recommended structure:

```md
# Active Work Plan

## Current milestone
Milestone 1 — Smart setup + event suggestions

## Current task
Add domain model support for:
- Memory.kind
- Memory.status
- Suggestion
- Project.timelineMode
- Project.assistLevel
- Project.styleIntensity

## Why
These are required before project-scoped suggestion flows can be built cleanly.

## Files to inspect first
- ARCHITECTURE.md
- src/types.ts
- src/storage.ts
- src/context/AppContext.tsx
- src/services/promptEngine.ts

## Constraints
- preserve current local-first storage model
- keep existing memory/page/editor flows working
- add migration-safe defaults
- avoid UI changes in this slice

## Definition of done
- types updated
- migration path added
- no existing project data breaks
- app compiles

## Next tasks
1. wire Suggestion CRUD into AppContext
2. convert prompt outputs to Suggestion objects
3. add project Suggestions screen scaffold