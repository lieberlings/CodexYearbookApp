import { StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";
import { SvgXml } from "react-native-svg";
import { getBackgroundAssetSourceUri } from "../layout/backgroundAssets";
import { loadSvgAssetXml } from "../services/svgAssetService";

type PageBackgroundProps = {
  backgroundAssetId?: string;
  backgroundColor?: string;
};

export function PageBackground({ backgroundAssetId, backgroundColor }: PageBackgroundProps) {
  const sourceUri = getBackgroundAssetSourceUri(backgroundAssetId);
  const [loaded, setLoaded] = useState<{ uri: string; xml: string }>();
  useEffect(() => {
    let active = true;
    if (sourceUri) {
      void loadSvgAssetXml(sourceUri).then(xml => {
        if (active) setLoaded({ uri: sourceUri, xml });
      }).catch(error => console.warn("Unable to load page background", error));
    }
    return () => { active = false; };
  }, [sourceUri]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: backgroundColor ?? "#ffffff" }]}>
      {loaded && loaded.uri === sourceUri ? (
        <SvgXml
          xml={loaded.xml}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
