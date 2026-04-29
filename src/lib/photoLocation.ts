import { PhotoItem } from "../types";

export function normalizePhotoLocation(
  location: PhotoItem["location"] | undefined
): PhotoItem["location"] | undefined {
  if (!location) {
    return undefined;
  }

  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return undefined;
  }
  if (latitude === 0 && longitude === 0) {
    return undefined;
  }

  return { latitude, longitude };
}

export function formatPhotoLocation(location: PhotoItem["location"] | undefined): string {
  const normalized = normalizePhotoLocation(location);
  if (!normalized) {
    return "No GPS metadata";
  }

  return `${normalized.latitude.toFixed(5)}, ${normalized.longitude.toFixed(5)}`;
}
