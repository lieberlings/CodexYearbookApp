export type BackgroundAssetKind = "solid" | "gradient" | "pattern" | "illustration" | "photo-texture";

export type BackgroundAsset = {
  number: number;
  id: string;
  label: string;
  theme: string;
  kind: BackgroundAssetKind;
  backgroundColor: string;
  assetUri?: string;
  palette: string[];
  tags: string[];
  textColor: string;
  slotBorderColor?: string;
  safeArea: { x: number; y: number; width: number; height: number };
  retired?: boolean;
};

export type BackgroundPack = {
  id: string;
  label: string;
  backgrounds: BackgroundAsset[];
};
