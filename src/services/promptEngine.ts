import { Memory, PhotoItem, PromptItem } from "../types";
import { makeId } from "../lib/id";

const DAY_MS = 24 * 60 * 60 * 1000;

export function generatePrompts(memories: Memory[], photos: PhotoItem[], now: Date = new Date()): PromptItem[] {
  const prompts: PromptItem[] = [];

  for (const memory of memories) {
    const memoryPhotos = photos.filter((photo) => photo.memoryId === memory.id);
    const lastUpdated = new Date(memory.updatedAt).getTime();
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated) / DAY_MS);

    if (daysSinceUpdate >= 7) {
      prompts.push({
        id: makeId("prompt"),
        type: "time-interval",
        title: "Revisit this memory",
        message: `"${memory.title}" has not been updated for ${daysSinceUpdate} days.`,
        memoryId: memory.id
      });
    }

    const photosInLast3Days = memoryPhotos.filter((photo) => {
      const addedAt = new Date(photo.addedAt).getTime();
      return now.getTime() - addedAt <= 3 * DAY_MS;
    });

    if (photosInLast3Days.length >= 8) {
      prompts.push({
        id: makeId("prompt"),
        type: "photo-spike",
        title: "Photo burst detected",
        message: `"${memory.title}" has ${photosInLast3Days.length} new photos in 3 days. Consider generating a page.`,
        memoryId: memory.id
      });
    }

    const locatedPhotos = memoryPhotos.filter((photo) => photo.location);
    if (locatedPhotos.length >= 5) {
      prompts.push({
        id: makeId("prompt"),
        type: "location-pattern",
        title: "Location pattern found",
        message: `"${memory.title}" includes at least 5 photos with location data. Add a map page for context.`,
        memoryId: memory.id
      });
    }
  }

  if (prompts.length === 0 && memories.length > 0) {
    prompts.push({
      id: makeId("prompt"),
      type: "time-interval",
      title: "No active prompts",
      message: "You are up to date. Add a few more photos to trigger smart reminders."
    });
  }

  if (prompts.length === 0 && memories.length === 0) {
    prompts.push({
      id: makeId("prompt"),
      type: "time-interval",
      title: "Create your first memory",
      message: "Start with one mini album and add photos from your library."
    });
  }

  return prompts;
}

