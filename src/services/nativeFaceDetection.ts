import type { PhotoNativeFaceMetadata } from "../types";

export type NativeFaceDetectionFace = Omit<PhotoNativeFaceMetadata, "source">;

export type NativeFaceDetectionResult = {
  source: PhotoNativeFaceMetadata["source"];
  available: boolean;
  faces: NativeFaceDetectionFace[];
  error?: string;
};

export async function detectFacesLocally(_uri: string): Promise<NativeFaceDetectionResult> {
  return {
    source: "android-mlkit-face-detection",
    available: false,
    faces: [],
    error: "Native face detection is only available in the Android dev build."
  };
}
