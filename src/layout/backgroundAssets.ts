import { Image } from "react-native";
import { BackgroundAsset } from "./backgroundTypes";
import { backgroundLibrary } from "../library/backgrounds";

export type BackgroundAssetSelection = {
  packId: string;
  packLabel: string;
  asset: BackgroundAsset;
};

export function getBackgroundAssetSelection(id: string | undefined): BackgroundAssetSelection | undefined {
  return id ? backgroundLibrary.selections.get(id) : undefined;
}

export function getBackgroundAssetSourceUri(id: string | undefined): string | undefined {
  if (!id) {
    return undefined;
  }
  const source = backgroundLibrary.sources.get(id);
  if (!source) {
    return undefined;
  }
  return Image.resolveAssetSource(source)?.uri;
}
