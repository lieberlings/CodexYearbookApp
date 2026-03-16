# Photobook Product & UX Spec

## Purpose

Build a privacy-centric, low-effort photobook creation app that helps users create valuable keepsakes over time with minimal final editing.

The core differentiator is a **memory-based build model**:
- the app helps organize content gradually as life happens
- the user stays in control
- the final “make the book” moment should feel mostly complete already

Initial target use cases:
- Yearbooks
- Vacations

Later use cases may include:
- Weddings
- Baby books
- Other giftable memory books

---

## Core Product Principles

### 1. The app notices, the user decides
The system should detect moments, themes, and strong photos, but should not silently make final editorial decisions.

The app may:
- suggest memories
- suggest photos
- suggest tags
- suggest layouts
- suggest decorative themes

The user should:
- accept
- edit
- dismiss
- postpone
- manually create alternatives

### 2. Lowest effort comes first
The product should reduce work, not add work.

Users should not feel like they are managing a complex AI system.
They should feel like they are being gently helped.

### 3. Privacy must be visible
Privacy should not only exist in architecture; it should be understandable in the experience.

Users should feel safe using the app for:
- children
- families
- personal travel
- gifts

### 4. Design should be tasteful by default
Generated decoration should be subtle and template-driven by default.
More expression can be optionally enabled per project or per memory.

### 5. The book is made from both moments and threads
The product should support:
- **Moments**: time-based memories such as birthdays, trips, events
- **Threads**: recurring collections such as pets, family, Leo’s face over the year, hiking, sunsets

---

## User Goals

Users want to:
- preserve meaningful memories without a lot of manual curation
- gradually build a book over time
- create something that still feels like their work
- trust the app with sensitive family content
- produce a beautiful printed keepsake

---

## Memory Model

The user-facing concept remains **Memory**, but internally memories can be of different kinds.

### Memory kinds
- `event` — time-bound moment
- `collection` — recurring theme across time
- `hybrid` — a mix of both

### Examples
Event:
- Leo’s Birthday
- Beach Day
- School Concert
- Arrival in Lisbon

Collection:
- Leo Through the Year
- Pets
- Hiking Highlights
- Best Food Moments
- Family Portraits

Hybrid:
- Summer in the Mountains
- Christmas Season

---

## Project Types

Initial supported project types:
- Yearbook
- Vacation

Each project should support:
- ongoing timeline
- past timeline
- hybrid timeline

### Ongoing
The project continues gathering material over time.

### Past
The project is created retroactively for a past time range.

### Hybrid
The user starts with a past time range and continues adding future memories.

---

## Key User Experience Flows

## A. Create Project

During project setup, the user chooses:
- project type
- date range or ongoing mode
- project title
- collaboration (optional)
- smart assist level
- style intensity
- privacy preferences
- optional people or themes that matter to this project

Examples:
- Leo’s Year 2026
- Italy Vacation 2026

### Project setup preferences
- quiet assist vs more proactive assist
- subtle vs expressive design
- use location or not
- enable people recognition or not
- invite contributor or not

---

## B. Initial Scan / Smart Intake

After setup, the app scans the selected photo range and produces:
- suggested event memories
- suggested collection memories
- suggested hero photos
- suggested tags/themes

This should work for both:
- current projects
- projects built from past timelines

The scan should not directly create final pages without user review.

---

## C. Suggestions

Suggestions should be project-scoped and first-class.

### Suggestion types
- event memory suggestion
- collection suggestion
- photo addition suggestion
- style suggestion
- finalization suggestion

### Good suggestion behavior
Every suggestion should:
- be easy to understand
- show why it was suggested
- be dismissible
- be editable before acceptance

### Example explanations
- Suggested because these photos were taken close together
- Suggested because this is a new location
- Suggested because Leo appears frequently here
- Suggested because these are your highest-rated photos this month
- Suggested because hiking appears repeatedly across the project

---

## D. Memory Creation

When the user taps a suggestion, they should enter a guided creation flow showing:
- title
- date range if relevant
- suggested photos
- highlighted best picks
- tags
- style/theme cues

The user can then:
- create memory
- save draft
- dismiss
- edit title/tags/dates
- remove or add photos

This should feel like:
“Here is a good starting point. You are in control.”

---

## E. Ongoing Collection Support

Not all meaningful memories are time-based.

The system must support collection-type memories that:
- evolve over time
- may begin as weak signals
- may only become valuable later
- may be manually declared by the user

### Collection examples
- Leo’s Faces
- Pets
- Hiking
- Family
- Sunsets
- Favorite Meals

### Collection lifecycle
A collection may exist as:
1. hidden internal pattern
2. watching draft
3. active memory
4. final book spread

### Recommended user actions for collections
- Start collection
- Keep watching
- Dismiss

This is different from event suggestions, which are more often:
- Accept now
- Snooze
- Dismiss

---

## F. Watching State

Add a user-facing “Watching” state for collection memories.

Purpose:
- avoid interrupting the user too early
- let themes accumulate over time
- provide a staging area before full commitment

Examples in Watching:
- Leo Through the Year
- Hiking Highlights
- Family Portraits

---

## G. Editing

Once a memory exists, the app should generate a clean first draft:
- suggested layout
- hero image
- tasteful photo grouping
- default styling

The user mainly refines:
- crop
- text
- order
- photo selection
- style intensity
- decorative accents

Editing should feel like refinement, not construction from scratch.

---

## H. Finalization Phase

Finalization should be a first-class stage in the product.

This phase is where the app helps the user enrich and polish the book near the end.

### Why finalization matters
Some valuable book content is only obvious when the project is nearly complete:
- recurring collections
- strongest unused photos
- book balance issues
- “through the year” spreads
- optional decorative finishing touches

### Finalization should include

#### 1. Missing moments
- underrepresented timeline periods
- dense photo clusters not yet used
- strong unused event groups

#### 2. Highlight collections
- recurring people
- pets
- hiking
- sunsets
- food
- family
- portrait sets
- “through the year” themes

#### 3. Best unused photos
- strongest portraits
- strongest scenic images
- strongest representative images not yet included

#### 4. Book polish
- stronger cover option
- ending spread suggestion
- section divider pages
- balance warnings
- consistency recommendations

### Important rule
Finalization must be optional.
Skipping it should still leave the user with a complete book.

---

## Collaboration v1

Initial collaboration model:
- one owner/editor
- one contributor

### Owner/editor can
- create project
- approve suggestions
- edit memories and pages
- manage settings
- finalize and order book

### Contributor can
- add photos
- view project progress

Later collaboration may expand, but v1 should stay simple.

---

## Privacy & Trust UX

### Product promise
- private by default
- sensitive recognition stays protected
- external services only receive generalized tags when needed for decorative generation
- user is in control of what is used

### Privacy-sensitive features
- person recognition
- child profiles
- personal details
- family associations

These should be:
- on-device first
- optional when needed
- clearly explained in settings and onboarding

### UX requirements
Users should be able to:
- disable people recognition
- disable location use
- remove tags
- hide a person or theme from suggestions
- control assist level

---

## Design System Direction

### Default behavior
- subtle
- template-driven
- emotionally warm
- not visually chaotic

### Style intensity options
Recommended per-project setting:
- Minimal
- Warm
- Playful
- Expressive

### Per-memory override
Each memory may optionally override project style intensity.

### Decorative outputs influenced by tags
Examples:
- dinosaur birthday -> playful accents and sticker suggestions
- beach day -> palette accents and light motif options
- school recital -> stage-like tasteful accents

The system should suggest decoration, not force it.

---

## User Controls

### Project-level controls
- smart assist level
- style intensity
- privacy settings
- collaboration
- timeline range
- location usage
- person recognition usage

### Memory-level controls
- title
- date range
- included photos
- tags
- hidden tags
- style override
- whether memory contributes to final book

### Suggestion-level controls
- accept
- dismiss
- snooze
- keep watching
- less like this / more like this (later)

---

## Information Architecture Recommendation

Each project should have these main sections:
- Overview
- Suggestions
- Memories
- Book
- Finalize

Optional sub-state:
- Watching

### Overview
Progress summary and key project actions.

### Suggestions
New event and collection ideas.

### Memories
Accepted and editable memory list.

### Book
Assembled book structure.

### Finalize
Guided finishing phase.

---

## Success Criteria

The product is successful when:
- users can create a meaningful book with very little final work
- the app feels helpful, not controlling
- privacy is a selling point
- the design looks premium by default
- yearbooks and vacations both work naturally
- recurring themes are captured without overwhelming the user

---

## Non-Goals for Early Versions

Do not prioritize early:
- fully autonomous book creation
- real-time collaborative editing
- highly expressive or chaotic generative visuals
- complex multi-role permissions
- heavy manual tagging workflows