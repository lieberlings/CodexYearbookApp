# Active Work Plan — Milestone 3.5

## Project
Photobook app — Android-first local image processing and inspector workflow

## Milestone
Milestone 3.5 — Local image processing inspector and Android-native integration prep

## Milestone goal
Create a practical developer-facing workflow for analyzing a single image locally, reviewing the pipeline outputs, and preparing the app for Android-native on-device image analysis.

This milestone should:
- add a single-image analysis inspector
- optionally refactor image analysis into a clearer internal module boundary
- prepare clean adapter seams for Android-native image analysis
- integrate Android-native face detection and generalized image labeling after the inspector is working

This milestone should not:
- implement person recognition
- move to cloud image processing
- redesign the app broadly
- build a full production photo manager

---

## Core documents for every Codex task
Before each substantial Codex task, point Codex to:
- `ARCHITECTURE.md`
- `docs/product/photobook_product_ux_spec.md`
- `docs/engineering/photobook_implementation_roadmap.md`
- `docs/engineering/image_analysis_pipeline_design.md`
- `docs/codex/codex_workflow_guide.md`
- `docs/codex/active_work_plan_milestone_3_5.md`

---

## Development workflow for this milestone

### Use this most of the time
Use Metro with the already-installed dev build:

```bash
npx expo start --dev-client
```

---

## Recently completed

- Task 1 completed: added a developer-facing single-image analysis inspector on the project details screen.
