import type { PickedPhotoAsset } from "./photoMetadataIngestion";

export type AndroidPhotoPickerOptions = {
  searchQuery?: string;
  selectionLimit?: number;
};

export type AndroidPhotoPickerResult = {
  available: boolean;
  assets: PickedPhotoAsset[];
  highlighted: boolean;
  error?: string;
};

export async function pickImagesWithAndroidPhotoPicker(
  _options: AndroidPhotoPickerOptions = {}
): Promise<AndroidPhotoPickerResult> {
  return {
    available: false,
    assets: [],
    highlighted: false,
    error: "Android Photo Picker is only available in the Android dev build."
  };
}
