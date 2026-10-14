import { Alert } from "react-native";
import type { LowResolutionPhoto } from "../../services/exportService";

const MAX_LISTED = 6;

export function lowResolutionMessage(photos: LowResolutionPhoto[]): string {
  const lines = photos.slice(0, MAX_LISTED).map((photo) => `• ${photo.pageLabel}: ${photo.ppi} PPI`);
  if (photos.length > MAX_LISTED) {
    lines.push(`• and ${photos.length - MAX_LISTED} more`);
  }
  const count = photos.length === 1 ? "1 photo is" : `${photos.length} photos are`;
  return `${count} too small for the size it prints at and may look blurry. 300 PPI is ideal; under 220 shows.\n\n${lines.join("\n")}\n\nUse a larger original, or make the photo smaller on the page.`;
}

// Resolves true when the user still wants to share the PDF.
export function confirmLowResolutionPhotos(photos: LowResolutionPhoto[]): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Some photos may print blurry", lowResolutionMessage(photos), [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Share anyway", onPress: () => resolve(true) }
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
