import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos`;

export async function ensurePhotosDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function pickImagesFromLibrary(): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission was not granted.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 0.6,
    base64: true
  });

  if (result.canceled) {
    return [];
  }

  return result.assets;
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
