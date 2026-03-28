import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { PhotoItem } from "../types";

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos`;

export type PickedPhotoAsset = {
  uri: string;
  fileName?: string | null;
  width?: number;
  height?: number;
  capturedAt?: string;
  location?: PhotoItem["location"];
};

function toIsoDateString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const timestamp = value < 1e12 ? value * 1000 : value;
    return new Date(timestamp).toISOString();
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
    .replace(" ", "T");
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function parseExifFraction(part: string): number | undefined {
  const trimmed = part.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!trimmed.includes("/")) {
    const direct = Number.parseFloat(trimmed);
    return Number.isFinite(direct) ? direct : undefined;
  }

  const [numerator, denominator] = trimmed.split("/");
  const num = Number.parseFloat(numerator ?? "");
  const den = Number.parseFloat(denominator ?? "");
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return undefined;
  }
  return num / den;
}

function applyCoordinateRef(value: number, ref: unknown): number {
  const normalizedRef = typeof ref === "string" ? ref.trim().toUpperCase() : "";
  if (normalizedRef === "S" || normalizedRef === "W") {
    return -Math.abs(value);
  }
  return value;
}

function parseExifCoordinate(value: unknown, ref?: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return applyCoordinateRef(value, ref);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return applyCoordinateRef(numeric, ref);
  }

  const parts = trimmed.split(",").map((part) => parseExifFraction(part));
  if (parts.length === 0 || parts.some((part) => part === undefined)) {
    return undefined;
  }

  const [degrees = 0, minutes = 0, seconds = 0] = parts as number[];
  const decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  return applyCoordinateRef(decimal, ref);
}

function extractCapturedAt(asset: ImagePicker.ImagePickerAsset): string | undefined {
  const exif = asset.exif ?? undefined;
  return (
    toIsoDateString(exif?.DateTimeOriginal) ??
    toIsoDateString(exif?.DateTimeDigitized) ??
    toIsoDateString(exif?.DateTime) ??
    toIsoDateString(exif?.CreationDate) ??
    toIsoDateString(asset.file?.lastModified)
  );
}

function extractLocation(asset: ImagePicker.ImagePickerAsset): PhotoItem["location"] | undefined {
  const exif = asset.exif ?? undefined;
  const latitude = parseExifCoordinate(exif?.GPSLatitude ?? exif?.latitude, exif?.GPSLatitudeRef);
  const longitude = parseExifCoordinate(exif?.GPSLongitude ?? exif?.longitude, exif?.GPSLongitudeRef);

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return undefined;
  }

  return {
    latitude,
    longitude
  };
}

function toPickedPhotoAsset(asset: ImagePicker.ImagePickerAsset): PickedPhotoAsset {
  return {
    uri: asset.uri,
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height,
    capturedAt: extractCapturedAt(asset),
    location: extractLocation(asset)
  };
}

export async function ensurePhotosDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function pickImagesFromLibrary(): Promise<PickedPhotoAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission was not granted.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 0.6,
    base64: true,
    exif: true
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(toPickedPhotoAsset);
}

export async function pickSingleImageFromLibrary(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission was not granted.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 0.7,
    base64: true
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0] ?? null;
}

export async function getCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return undefined;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude
  };
}

export async function copyImageToAppStorage(
  sourceUri: string,
  photoId: string,
  fileNameHint?: string | null
): Promise<string> {
  await ensurePhotosDirectory();

  const hintMatch = fileNameHint?.match(/\.([a-zA-Z0-9]{3,4})$/);
  const uriMatch = sourceUri.match(/\.([a-zA-Z0-9]{3,4})(\?|$)/);
  const extension = hintMatch?.[1] ?? uriMatch?.[1] ?? "jpg";
  const fileName = `${photoId}.${extension ?? "jpg"}`;
  const destination = `${PHOTOS_DIR}/${fileName}`;

  try {
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destination
    });

    return destination;
  } catch {
    // If a content URI cannot be copied on a specific device/OS variant,
    // keep the original URI so the photo is still usable in the memory.
    return sourceUri;
  }
}
