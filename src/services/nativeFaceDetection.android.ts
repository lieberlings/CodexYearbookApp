import { NativeModules } from "react-native";
import type { NativeFaceDetectionFace, NativeFaceDetectionResult } from "./nativeFaceDetection";

type YearbookFaceDetectionModule = {
  detectFaces(uri: string): Promise<NativeFaceDetectionResult>;
};

const nativeModule = NativeModules.YearbookFaceDetection as YearbookFaceDetectionModule | undefined;

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeNativeFace(face: NativeFaceDetectionFace): NativeFaceDetectionFace | undefined {
  const x = normalizeOptionalNumber(face?.bounds?.x);
  const y = normalizeOptionalNumber(face?.bounds?.y);
  const width = normalizeOptionalNumber(face?.bounds?.width);
  const height = normalizeOptionalNumber(face?.bounds?.height);
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined;
  }

  return {
    bounds: { x, y, width, height },
    headEulerAngleY: normalizeOptionalNumber(face.headEulerAngleY),
    headEulerAngleZ: normalizeOptionalNumber(face.headEulerAngleZ),
    smilingProbability: normalizeOptionalNumber(face.smilingProbability),
    leftEyeOpenProbability: normalizeOptionalNumber(face.leftEyeOpenProbability),
    rightEyeOpenProbability: normalizeOptionalNumber(face.rightEyeOpenProbability),
    trackingId: normalizeOptionalNumber(face.trackingId)
  };
}

export async function detectFacesLocally(uri: string): Promise<NativeFaceDetectionResult> {
  if (!nativeModule) {
    return {
      source: "android-mlkit-face-detection",
      available: false,
      faces: [],
      error: "YearbookFaceDetection native module is not available."
    };
  }

  try {
    const result = await nativeModule.detectFaces(uri);
    return {
      source: "android-mlkit-face-detection",
      available: result.available === true,
      faces: Array.isArray(result.faces)
        ? result.faces.map(normalizeNativeFace).filter((face): face is NativeFaceDetectionFace => Boolean(face))
        : [],
      error: typeof result.error === "string" && result.error.trim() ? result.error : undefined
    };
  } catch (error) {
    return {
      source: "android-mlkit-face-detection",
      available: false,
      faces: [],
      error: error instanceof Error ? error.message : "Native face detection failed."
    };
  }
}
