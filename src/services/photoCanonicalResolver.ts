import type * as ImagePicker from "expo-image-picker";
import type { PhotoMetadataResolutionKind } from "../types";

export type CanonicalAssetMetadataSource = {
  exif?: Record<string, unknown> | null;
  location?: {
    latitude?: unknown;
    longitude?: unknown;
  } | null;
  creationTime?: unknown;
};

export type CanonicalPhotoMetadataResolutionKind = PhotoMetadataResolutionKind;

export type CanonicalPhotoMetadataResolution = {
  assetId?: string;
  metadata?: CanonicalAssetMetadataSource;
  kind: CanonicalPhotoMetadataResolutionKind;
};

export type CanonicalPhotoMetadataResolver = (
  asset: ImagePicker.ImagePickerAsset
) => Promise<CanonicalPhotoMetadataResolution>;

export function createPickerFallbackResolution(
  asset: ImagePicker.ImagePickerAsset
): CanonicalPhotoMetadataResolution {
  return {
    assetId: typeof asset.assetId === "string" && asset.assetId.length > 0 ? asset.assetId : undefined,
    metadata: undefined,
    kind: "picker-fallback"
  };
}
