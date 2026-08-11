# AGENTS.md

## Project

YearBook App is an Android-first React Native + Expo app for capturing memories and exporting simple photobooks.

The repository root is `C:\Users\Lieber\Documents\YearBookApp\CodexYearbookApp`.

## Commands

- Install dependencies: `npm install`
- Start Expo: `npm run start`
- Run Android app: `npm run android`
- Lint: `npm run lint`
- Test: `npm test`
- Type check: `npm exec tsc -- --noEmit`
- Android Kotlin compile: from `android`, run `.\gradlew.bat :app:compileDebugKotlin --console=plain --no-daemon`

## Architecture Direction

- Keep the MVP memory-first: Project, Memory, Suggested Memory, Theme Page, Finalization.
- Do not make project-level photo pools, image-analysis inspectors, cluster inspectors, media-library probes, raw ML Kit debug panels, or similar dev tools part of the normal user experience.
- Suggested memories should be on-device, project-scoped, date/time/location driven, review-based, and non-importing until accepted.
- Treat `CandidatePhotoRef` as a temporary source-media or picker reference.
- Treat `PhotoItem` as an imported app photo that belongs to a memory or accepted theme page.
- Preserve useful internal infrastructure, including canonical media resolution, Android Media Library metadata preservation, metadata normalization, image-analysis service boundaries, ML Kit experiments, and cluster-engine experiments, but keep them behind the MVP flow.

## Android Notes

- Android is the first target platform.
- For metadata-rich scans, prefer Media Library / MediaStore-backed flows where available.
- For explicit manual selection, prefer Android Photo Picker / Embedded Photo Picker behavior where it fits the UX.
- Picker fallback photos may not have canonical MediaStore asset ids or GPS metadata; do not require those fields for manual picker imports.

## Working Agreements

- Prefer small, focused changes that match the existing Expo Router and service/context layout.
- Do not edit generated files or native build outputs.
- Ask before adding new production dependencies.
- Keep secrets, keystores, signing config, API keys, and local-only SDK config out of the repo.
- When changing behavior, run the narrowest relevant verification command and report anything that could not be run.
