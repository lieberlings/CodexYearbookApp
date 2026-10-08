import { useId, useState } from "react";
import Svg, { ClipPath, Defs, G, Image, Path } from "react-native-svg";
import { StyleSheet } from "react-native";
import { ObjectShape as Shape } from "../types";
import { shapePath } from "../layout/objectShapes";

export function ObjectShape({ shape, uri, metrics, fill = "transparent", border = "transparent", borderWidth = 0 }: {
  shape: Shape; uri?: string; metrics?: { width: number; height: number; leftPercent: number; topPercent: number };
  fill?: string; border?: string; borderWidth?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [aspect, setAspect] = useState(1);
  const path = shapePath(shape);
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%"
    onLayout={({ nativeEvent: { layout } }) => { if (layout.width > 0 && layout.height > 0) setAspect(layout.width / layout.height); }}
    viewBox={`0 0 ${100 * aspect} 100`} preserveAspectRatio="none">
    <Defs><ClipPath id={id}><Path d={path} transform={`scale(${aspect} 1)`} /></ClipPath></Defs>
    <Path d={path} fill={fill} transform={`scale(${aspect} 1)`} />
    {uri && <Image href={{ uri }} x={(metrics?.leftPercent ?? 0) * aspect} y={metrics?.topPercent ?? 0}
      width={(metrics?.width ?? 1) * 100 * aspect} height={(metrics?.height ?? 1) * 100} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />}
    <G transform={`scale(${aspect} 1)`}><Path d={path} fill="none" stroke={border} strokeWidth={borderWidth} /></G>
  </Svg>;
}
