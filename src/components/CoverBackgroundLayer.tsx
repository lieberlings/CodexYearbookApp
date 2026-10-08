import { Image, StyleSheet, View } from "react-native";
import type { CoverDesign, CoverPanel } from "../types";
import { coverPanelRegion } from "../layout/bookSpreads";
import { PageBackground } from "./PageBackground";

// Render the same full-spread background behind each clipped panel. This keeps
// the crop continuous when the front or back is enlarged for editing.
export function CoverBackgroundLayer({ design, panel, width }: { design?: CoverDesign; panel: CoverPanel; width: number }) {
  const region = coverPanelRegion(panel, design);
  const scale = width / region.width;
  const background = design?.background;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden", backgroundColor: background?.color ?? "#FBF6EE" }]}>
    <View style={{ position: "absolute", left: -region.x * scale, top: 0, width: region.total * scale, height: region.height * scale }}>
      <PageBackground backgroundColor={background?.color ?? "#FBF6EE"} backgroundAssetId={background?.kind === "library" ? background.assetId : undefined} />
      {background?.kind === "photo" && background.photoUri && <Image source={{ uri: background.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
    </View>
  </View>;
}
