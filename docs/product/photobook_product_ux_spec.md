# MVP Product Direction — Memory-First Reset

## Summary
The MVP should focus on a simpler memory-first workflow.

The app should help users create a photobook by:
- creating projects
- editing memories
- receiving event-based suggested memories
- creating user-led theme pages
- finalizing accepted content

The MVP should not expose project-level photo management or debug image-analysis tools in the normal user experience.

## Primary user promise
The app helps users create a meaningful photobook with less effort, while keeping the user in control.

The app suggests likely memories and themes, but the user decides:
- which suggestions to accept
- which photos to include
- how memories are edited
- what appears in the final book

## Core MVP workflow

### 1. Create project
User creates a project with:
- name
- thumbnail image
- timeline mode:
  - past
  - ongoing
  - hybrid
- date range when applicable
- scan interval for ongoing/hybrid:
  - manual
  - 1 day
  - 1 week
  - 1 month

### 2. Review project
The project screen should be simple and organized around:
- memories
- suggested memories
- suggested theme pages
- finalization

Avoid exposing:
- project photo pools
- raw cluster lists
- analysis/debug tools
- media-library probes

### 3. Edit memories
Memory-level editing remains the main creative workflow.

Within a memory, the user can:
- add/select photos
- arrange pages
- edit layouts
- add text
- adjust style
- preview/export

### 4. Suggested memories
Suggested memories are event-based.

They are generated from on-device media-library scans using:
- date range
- capture time
- photo bursts
- GPS/location clusters
- temporal relevance
- optional quality/face/group signals if available

Suggested memories should appear as a reviewable list or collapsed section.

Each suggested memory should support:
- review candidate photos
- accept
- reject
- snooze

When accepted:
- user selects from candidate photos
- selected photos are imported into a normal memory
- the memory enters the normal memory workflow

When rejected:
- suggestion is discarded
- candidate photos do not remain part of the project unless already used elsewhere

### 5. Suggested theme pages
Theme pages are user-led.

A user chooses:
- a suggested theme
- or a custom theme/search term

Suggested themes may include:
- Pets
- Christmas
- Desserts
- Hiking
- Funny faces
- Grandparents
- Beach
- Birthdays

The app opens a picker/search flow for the theme.

On Android, where supported, the app should use Photo Picker search highlighting so the picker opens with relevant search results highlighted for the chosen term.

The user then selects photos and chooses:
- add to existing theme page
- create new theme page

The app should not automatically import all theme search results.

### 6. Finalization
Finalization helps the user finish the book.

MVP finalization should gather unused photos only from:
- accepted memories
- accepted theme pages

The user can:
- use them in pages
- discard them
- ignore them

Finalization should not automatically scan the entire raw library again.

## MVP principles

### Memory-level editing only
The normal user workflow should not require or expose project-level photo pools.

### Suggestions are temporary until accepted
Suggested memory photos and theme picker results are not project photos until the user accepts/selects them.

### User control
No automatic memory/page creation without review.

### Privacy
On-device scans should stay scoped to project settings.

Cloud photos should require explicit user selection.

### Print quality
Imported photos should preserve the highest available/original-quality source available from the provider.

The app should record dimensions and eventually warn when photos may be too low-resolution for print.

## Deferred from MVP
- full automatic theme clustering
- full-library image processing
- person recognition
- unattended cloud Google Photos scanning
- commerce/order flow
- realtime collaboration
- polished debug analysis tooling