import { NativeModules } from "react-native";
import type { NativeImageLabel, NativeImageLabelingResult } from "./nativeImageLabeling";

type YearbookImageLabelingModule = {
  labelImage(uri: string): Promise<NativeImageLabelingResult>;
};

const nativeModule = NativeModules.YearbookImageLabeling as YearbookImageLabelingModule | undefined;

function normalizeNativeLabel(label: NativeImageLabel): NativeImageLabel | undefined {
  if (typeof label?.text !== "string" || !label.text.trim()) {
    return undefined;
  }
  if (typeof label.confidence !== "number" || !Number.isFinite(label.confidence)) {
    return undefined;
  }
  return {
    text: label.text.trim(),
    confidence: label.confidence,
    index: typeof label.index === "number" && Number.isFinite(label.index) ? label.index : undefined
  };
}

export async function labelImageLocally(uri: string): Promise<NativeImageLabelingResult> {
  if (!nativeModule) {
    return {
      source: "android-mlkit-image-labeling",
      available: false,
      labels: [],
      error: "YearbookImageLabeling native module is not available."
    };
  }

  try {
    const result = await nativeModule.labelImage(uri);
    return {
      source: "android-mlkit-image-labeling",
      available: result.available === true,
      labels: Array.isArray(result.labels)
        ? result.labels.map(normalizeNativeLabel).filter((label): label is NativeImageLabel => Boolean(label))
        : [],
      error: typeof result.error === "string" && result.error.trim() ? result.error : undefined
    };
  } catch (error) {
    return {
      source: "android-mlkit-image-labeling",
      available: false,
      labels: [],
      error: error instanceof Error ? error.message : "Native image labeling failed."
    };
  }
}
