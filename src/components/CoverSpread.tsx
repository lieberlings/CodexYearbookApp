import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LayoutPage } from "../layout/schemas";
import type { CoverPanel, PhotoItem, Project } from "../types";
import { coverGeometry, usesSharedCoverBackground } from "../layout/bookSpreads";
import { BookPageCanvas } from "./BookPageCanvas";
import { CoverBackgroundLayer } from "./CoverBackgroundLayer";

export function CoverPanelPreview({ project, panel, page, photosById, size }: {
  project: Project; panel: "front" | "back"; page?: LayoutPage; photosById: Record<string, PhotoItem>; size: number;
}) {
  const background = usesSharedCoverBackground(panel, project.coverDesign)
    ? <CoverBackgroundLayer design={project.coverDesign} panel={panel} width={size} /> : undefined;
  return page ? <BookPageCanvas page={page} photosById={photosById} size={size} background={background} />
    : <View style={{ width: size, height: size, backgroundColor: "#FBF6EE" }}>{background}</View>;
}

export function SpinePreview({ project, height, width }: { project: Project; height: number; width: number }) {
  const design = project.coverDesign;
  const title = design?.spineTitle ?? project.name;
  const text = [title, design?.spineSubtitle].filter(Boolean).join("  ·  ");
  return <View style={{ width, height, overflow: "hidden", backgroundColor: design?.spineColor ?? design?.background?.color ?? "#E8DCCB" }}>
    {!design?.spineColor && design?.background && <CoverBackgroundLayer design={design} panel="spine" width={width} />}
    <View style={{ position: "absolute", width: height * .82, height: width, left: (width - height * .82) / 2, top: (height - width) / 2,
      justifyContent: "center", transform: [{ rotate: design?.spineDirection === "up" ? "-90deg" : "90deg" }] }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.3} style={{ color: design?.spineTextColor ?? "#241F1B", fontWeight: "600", fontSize: Math.max(5, width * .52), textAlign: "center", includeFontPadding: false }}>{text}</Text>
    </View>
  </View>;
}

export function CoverSpread({ project, front, back, photosById, width, selected, onSelect, guides = false }: {
  project: Project; front?: LayoutPage; back?: LayoutPage; photosById: Record<string, PhotoItem>; width: number;
  selected?: CoverPanel; onSelect?: (panel: CoverPanel) => void; guides?: boolean;
}) {
  const geometry = coverGeometry(project.coverDesign);
  const size = width * geometry.panel / geometry.total;
  const spine = width - size * 2;
  return <View style={{ flexDirection: "row", width, height: size, backgroundColor: "#FBF6EE" }}>
    {(["back", "spine", "front"] as const).map(panel => <Pressable key={panel} disabled={!onSelect} onPress={() => onSelect?.(panel)}
      accessibilityRole={onSelect ? "button" : undefined} accessibilityLabel={`Select ${panel === "spine" ? "spine" : `${panel} cover`}`}
      accessibilityState={{ selected: selected === panel }} style={{ width: panel === "spine" ? spine : size, height: size }}>
      {panel === "spine" ? <SpinePreview project={project} height={size} width={spine} />
        : <CoverPanelPreview project={project} panel={panel} page={panel === "front" ? front : back} photosById={photosById} size={size} />}
      {guides && panel !== "spine" && <View pointerEvents="none" style={{ position: "absolute", left: "5%", right: "5%", top: "5%", bottom: "5%", borderWidth: 1, borderStyle: "dashed", borderColor: "#BB7855" }} />}
      {(selected === panel || guides) && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: selected === panel ? 2 : 1, borderColor: selected === panel ? "#6B5BD2" : "#BB7855" }]} />}
    </Pressable>)}
  </View>;
}

// The spine enlarged, with a strip of the back and front cover on each side so
// the shared background reads as it will on the printed book.
export function SpineCloseUp({ project, front, back, photosById, height }: {
  project: Project; front?: LayoutPage; back?: LayoutPage; photosById: Record<string, PhotoItem>; height: number;
}) {
  const geometry = coverGeometry(project.coverDesign);
  const width = height * geometry.total / geometry.panel;
  const spine = width - height * 2;
  const strip = Math.min(height * .3, 60);
  return <View style={{ width: spine + strip * 2, height, overflow: "hidden", borderRadius: 8 }}>
    <View style={{ position: "absolute", left: strip - height, top: 0 }}>
      <CoverSpread project={project} front={front} back={back} photosById={photosById} width={width} />
    </View>
    <View pointerEvents="none" style={{ position: "absolute", left: strip, width: spine, top: 0, bottom: 0, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#00000033" }} />
  </View>;
}
