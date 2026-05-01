import type { PhotoNativeImageLabelMetadata } from "../types";

export type NativeImageLabel = {
  text: string;
  confidence: number;
  index?: number;
};

export type NativeImageLabelingResult = {
  source: PhotoNativeImageLabelMetadata["source"];
  available: boolean;
  labels: NativeImageLabel[];
  error?: string;
};

export async function labelImageLocally(_uri: string): Promise<NativeImageLabelingResult> {
  return {
    source: "android-mlkit-image-labeling",
    available: false,
    labels: [],
    error: "Native image labeling is only available in the Android dev build."
  };
}
