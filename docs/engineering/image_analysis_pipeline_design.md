# MVP Position Note

Image analysis is no longer a core MVP dependency.

The image-analysis pipeline remains valuable for future improvements, but the MVP should rely primarily on:
- capture time
- date ranges
- GPS/location
- photo bursts
- user-selected theme picker results
- optional lightweight quality/face signals when already available

## MVP usage of image analysis
For MVP, image analysis may be used only as a supporting signal.

It should not be required for:
- suggested event memories
- project creation
- memory editing
- theme page creation
- finalization

## Suggested memories
Suggested event memories should be generated from on-device media-library metadata.

Primary signals:
- timestamp
- burst density
- GPS/location clusters
- location changes
- project date range

Optional supporting signals:
- quality score
- face/group count

Avoid relying on raw native image labels for MVP event suggestions.

## Theme pages
Theme pages should use user-led picker/search flows rather than automatic image classification.

On Android, the app may use Photo Picker search highlighting where available to help the user find theme photos.

Raw image labels should not be the primary theme-page mechanism for MVP.

## Debug tools
The following are development tools, not MVP user features:
- single-image analysis inspector
- raw ML Kit label display
- raw face-detection display
- cluster inspector
- media-library probe panels

## Future use
The pipeline may later support:
- better quality scoring
- person/profile features
- theme recommendations
- Gemini/Nano interpretation
- CLIP/vector-style grouping
- improved finalization suggestions

These should be phased in only after the MVP memory-suggestion workflow is stable.