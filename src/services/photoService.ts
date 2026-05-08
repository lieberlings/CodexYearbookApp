import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import {
  ensureAndroidMediaLibraryPermission,
  getAndroidMediaLibraryPermissionProbe,
  probeAndroidMediaLibraryAssetMetadata,
  resolveCanonicalPhotoMetadataAndroid
} from "./photoCanonicalResolver.android";
import type { AndroidMediaLibraryAssetProbe } from "./photoCanonicalResolver.android";
import {
  buildPickedPhotoAsset,
  buildPickedPhotoAssetFromMediaLibraryAsset,
  PickedPhotoAsset
} from "./photoMetadataIngestion";

export type { PickedPhotoAsset } from "./photoMetadataIngestion";

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos`;

export type MediaLibraryAssetProbe = AndroidMediaLibraryAssetProbe;

export type MediaLibraryPhotoChoice = {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  creationTime: number;
};

export type MediaLibraryPhotoCatalogProbe = {
  permissionStatus?: string;
  permissionGranted: boolean;
  canAskAgain: boolean;
  requestAttempted: boolean;
  requestGranted: boolean;
  queryAttempted: boolean;
  returnedCount: number;
  totalCount?: number;
  hasNextPage?: boolean;
  endCursor?: string;
  error?: string;
};


export async function probeMediaLibraryAssetMetadata(
  assetId: string | undefined
): Promise<MediaLibraryAssetProbe> {
  return probeAndroidMediaLibraryAssetMetadata(assetId);
}

export async function getRecentMediaLibraryPhotoChoices(limit = 60): Promise<MediaLibraryPhotoChoice[]> {
  const result = await getRecentMediaLibraryPhotoChoicesWithProbe(limit);
  return result.choices;
}

export async function getRecentMediaLibraryPhotoChoicesWithProbe(
  limit = 60,
  after?: string
): Promise<{
  choices: MediaLibraryPhotoChoice[];
  probe: MediaLibraryPhotoCatalogProbe;
}> {
  const permissionProbe = await getAndroidMediaLibraryPermissionProbe();
  if (!permissionProbe.permissionGranted) {
    return {
      choices: [],
      probe: {
        permissionStatus: permissionProbe.permissionStatus,
        permissionGranted: false,
        canAskAgain: permissionProbe.canAskAgain,
        requestAttempted: permissionProbe.requestAttempted,
        requestGranted: permissionProbe.requestGranted,
        queryAttempted: false,
        returnedCount: 0
      }
    };
  }

  try {
    const queryOptions: Parameters<typeof MediaLibrary.getAssetsAsync>[0] = {
      first: limit,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime]
    };
    if (after) {
      queryOptions.after = after;
    }

    const page = await MediaLibrary.getAssetsAsync(queryOptions);

    return {
      choices: page.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime
      })),
      probe: {
        permissionStatus: permissionProbe.permissionStatus,
        permissionGranted: true,
        canAskAgain: permissionProbe.canAskAgain,
        requestAttempted: permissionProbe.requestAttempted,
        requestGranted: permissionProbe.requestGranted,
        queryAttempted: true,
        returnedCount: page.assets.length,
        totalCount: page.totalCount,
        hasNextPage: page.hasNextPage,
        endCursor: page.endCursor
      }
    };
  } catch (error) {
    return {
      choices: [],
      probe: {
        permissionStatus: permissionProbe.permissionStatus,
        permissionGranted: true,
        canAskAgain: permissionProbe.canAskAgain,
        requestAttempted: permissionProbe.requestAttempted,
        requestGranted: permissionProbe.requestGranted,
        queryAttempted: true,
        returnedCount: 0,
        error: error instanceof Error ? error.message : "Media Library asset query failed."
      }
    };
  }
}

export async function pickPhotoFromMediaLibraryByAssetId(
  assetId: string
): Promise<PickedPhotoAsset | undefined> {
  const permissionGranted = await ensureAndroidMediaLibraryPermission();
  if (!permissionGranted) {
    return undefined;
  }

  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
    return buildPickedPhotoAssetFromMediaLibraryAsset(assetInfo, {
      exif: (assetInfo as { exif?: Record<string, unknown> | null }).exif ?? undefined,
      location:
        assetInfo.location && typeof assetInfo.location === "object"
          ? {
              latitude: (assetInfo.location as { latitude?: unknown }).latitude,
              longitude: (assetInfo.location as { longitude?: unknown }).longitude
            }
          : undefined,
      creationTime: assetInfo.creationTime
    });
  } catch {
    return undefined;
  }
}

export async function pickPhotosFromMediaLibraryByAssetIds(assetIds: string[]): Promise<PickedPhotoAsset[]> {
  const resolved = await Promise.all(assetIds.map((assetId) => pickPhotoFromMediaLibraryByAssetId(assetId)));
  return resolved.filter((asset): asset is PickedPhotoAsset => Boolean(asset));
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

  return Promise.all(
    result.assets.map(async (asset) => {
      const resolved = await resolveCanonicalPhotoMetadataAndroid(asset);
      return buildPickedPhotoAsset(asset, resolved);
    })
  );
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
