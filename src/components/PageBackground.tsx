import { StyleSheet, View } from "react-native";
import { SvgUri } from "react-native-svg";
import { getBackgroundAssetSourceUri } from "../layout/backgroundAssets";

type PageBackgroundProps = {
  backgroundAssetId?: string;
  backgroundColor?: string;
};

export function PageBackground({ backgroundAssetId, backgroundColor }: PageBackgroundProps) {
  const sourceUri = getBackgroundAssetSourceUri(backgroundAssetId);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: backgroundColor ?? "#ffffff" }]}>
      {sourceUri ? (
        <SvgUri
          uri={sourceUri}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
