# Image Analysis Pipeline Design

## Purpose

Define a privacy-centric, incremental image-analysis pipeline for the photobook app.

This pipeline should:
- improve event and collection suggestions
- improve candidate photo additions
- improve finalization quality
- preserve a strong privacy posture
- remain practical for a React Native / Expo-based app
- avoid premature custom ML complexity

This document assumes:
- the app is local-first
- mobile is the primary experience
- web is important, but secondary for image analysis
- yearbooks and vacations are the first target project types

---

## Goals

### Product goals
- use image understanding to reduce user effort
- keep users in control of what enters memories
- support better event suggestions, collection suggestions, and highlight-photo selection
- enable later person/profile features like “Leo through the year”

### Technical goals
- keep privacy-sensitive analysis on device by default
- leverage existing libraries and platform frameworks instead of training custom models from scratch
- support incremental rollout
- fit the current project/memory/photo architecture
- remain compatible with Expo development builds and a future web editor

---

## Non-goals (initially)

Do not attempt in the first image-analysis phase:
- cloud-based face recognition by default
- end-to-end custom model training
- fully automated memory creation
- strong identity recognition before privacy controls are ready
- perfect cross-platform parity on day one
- heavy background analysis infrastructure

---

## High-level architecture

The image-analysis system should be a layered pipeline:

1. **Photo intake**
2. **Metadata extraction**
3. **On-device image analysis**
4. **Metadata persistence**
5. **Suggestion and matching logic**
6. **Privacy-filtered downstream usage**

### Principle
The pipeline should **produce metadata**, not direct editorial decisions.

The app uses that metadata to:
- suggest memories
- suggest candidate photos
- suggest collection members
- suggest finalization improvements

The user still decides what is included.

---

## Why existing libraries/frameworks should be used

The app should rely on platform-native and established libraries wherever possible.

### Expo and app-level integration
Expo supports custom native code through development builds, which is the right route once this app needs native vision or ML integration. Expo explicitly recommends development builds for customizing beyond what Expo Go includes. 

### Photo intake
Expo provides supported libraries for selecting images and accessing local files, including `expo-image-picker` and `expo-file-system`. These are suitable for the app’s photo intake layer. 

### On-device vision
Apple’s Vision framework provides native image-analysis capabilities such as face observations and image-analysis tasks on iOS. 

Google ML Kit provides on-device face detection, but Google explicitly notes that face detection is not face recognition or person identification. 

### Shared custom model runtimes
TensorFlow.js can run in React Native and the browser, but it should be treated as a later option for specific needs rather than the default first implementation. 

---

## Recommended implementation strategy

Use a **hybrid approach**:

- **Expo / React Native** for UI, project logic, intake flows, local orchestration
- **Native platform vision frameworks** for first-pass on-device image analysis
- **Custom local model runtime only where necessary**
- **Web consumes existing metadata first**, instead of duplicating full analysis immediately

This gives the app:
- good performance
- strong privacy posture
- faster implementation
- less ML maintenance burden

---

## Pipeline overview

## 1. Photo intake layer

### Inputs
Photos enter the app through:
- project photo pool additions
- direct memory additions
- contributor uploads
- future ongoing project intake
- optional camera capture later

### Responsibilities
At intake, the app should:
- persist the photo asset reference
- associate it with `projectId`
- optionally associate it with `memoryId`
- record base metadata:
  - local URI / asset identifier
  - capture timestamp
  - added timestamp
  - width / height
  - location if available and allowed
  - source type (library, camera, contributor, imported)

### Recommended tools
- `expo-image-picker`
- `expo-file-system`
- existing local storage model and `AppContext` orchestration 

---

## 2. Metadata extraction layer

This is not “AI” yet. It is the basic normalization layer.

### Outputs
- capture date/time
- project membership
- memory membership
- GPS presence / normalized coarse location
- aspect ratio
- image dimensions
- source type
- basic EXIF if available

### Why this matters
Even without image analysis, these fields power:
- time-based event clustering
- vacation-day grouping
- date-range filtering
- simple hero-photo selection
- duplicate handling scaffolding

---

## 3. On-device image-analysis layer

This is where the app adds meaningful image understanding.

The analysis layer should be broken into services.

### Service structure
Create service boundaries like:
- `photoQualityService`
- `sceneAnalysisService`
- `faceDetectionService`
- `photoSimilarityService`
- `collectionMatchingService` (uses metadata, not raw ML directly)

These services should not mutate project state directly.
They should return metadata to be stored and used elsewhere.

---

## 3A. Photo quality service

### Purpose
Help the app identify stronger photos for:
- event suggestions
- candidate additions
- hero images
- finalization

### Signals
- blur / sharpness heuristics
- exposure issues
- duplicate-like detection support
- composition proxies where feasible
- portrait-strength or scenic-strength cues later

### Output examples
- `qualityScore`
- `isBlurry`
- `isLowLight`
- `isLikelyStrongHeroCandidate`

### Implementation notes
Start with lightweight heuristics.
Do not try to build a professional aesthetic scoring system at first.

---

## 3B. Scene analysis service

### Purpose
Generate coarse scene/theme tags that help:
- event suggestions
- collection matching
- decoration prompts
- finalization suggestions

### Desired coarse outputs
Examples:
- indoor
- outdoor
- beach
- city
- landscape
- food
- party-like
- sunset-like
- hiking-like
- portrait
- group photo
- pet-like

### Privacy classification
These outputs should be treated as **generalized tags** and may later be eligible for outside decorative-generation calls if needed.

### Recommended implementation
Use native platform image-analysis capabilities first where possible.
On iOS this can be platform-native Vision-based analysis; Android may require ML Kit or other native support depending on the exact feature. 

---

## 3C. Face detection service

### Purpose
Improve:
- portrait/group cues
- family-oriented suggestions
- future person-aware collections
- child-focused project behavior later

### Important privacy note
At this stage, face detection should mean:
- detect faces
- count faces
- locate faces
- identify portrait/group characteristics

It should **not yet** mean named person recognition.

### Output examples
- `faceCount`
- `hasFace`
- `hasMultipleFaces`
- `isPortraitLike`
- face bounding boxes if needed locally

### Recommended implementation
Use platform-native face detection first.
ML Kit’s face detection is appropriate for detection and landmarks, but it is not a recognition system. 

---

## 3D. Photo similarity / duplicate service

### Purpose
Help avoid overwhelming the user with near-duplicates.

### Uses
- burst cleanup
- strongest-photo recommendation
- hero-photo selection
- finalization candidate selection

### Output examples
- `duplicateClusterId`
- `similarityGroupId`
- `representativePhotoScore`

### Implementation notes
This can begin with simple heuristics:
- timestamp proximity
- size/orientation
- burst grouping
- optional image-hash-like comparisons later

---

## 4. Metadata persistence model

The analysis output should be persisted as metadata attached to photos, not recomputed every time.

### Recommendation
Extend the current photo record with an analysis block.

### Example structure
```ts id="lxr2sv"
type PhotoAnalysisMetadata = {
  analysisVersion?: number;
  analyzedAt?: string;

  // Base quality
  qualityScore?: number;
  isBlurry?: boolean;
  isLowLight?: boolean;
  heroCandidateScore?: number;

  // Scene / content
  sceneTags?: string[];
  themeTags?: string[];
  portraitLike?: boolean;
  groupPhotoLike?: boolean;

  // Face detection only at first
  faceCount?: number;
  hasFace?: boolean;
  hasMultipleFaces?: boolean;

  // Similarity / duplicate
  duplicateClusterId?: string;
  representativeScore?: number;

  // Privacy classification
  safeExternalTags?: string[];

  // Sensitive local-only fields
  privateFaceDataRef?: string;
};