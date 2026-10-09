import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buildColorSections, quickColors, sameColor } from "./colorPickerModel";
import { addRecentColor, useRecentColors } from "./recentColors";
import { colors, radii, spacing, type } from "./theme";

type ColorPickerProps = {
  label: string;
  value?: string;
  onChange: (color: string) => void;
  // Palette of the page's background, offered first so text and borders match the design.
  themeColors?: readonly string[];
};

// The one color control used across the app: the current color plus a few
// suggestions, and "More" for the full palette, in the same place every time.
export function ColorPicker({ label, value, onChange, themeColors = [] }: ColorPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const recent = useRecentColors();

  function choose(color: string) {
    addRecentColor(color);
    onChange(color);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={type.label}>{label}</Text>
        {value ? <Swatch color={value} selected label={`${label}: current color ${value}`} /> : null}
      </View>
      <View style={styles.row}>
        {quickColors(value, themeColors, recent).map((color) => (
          <Swatch key={color} color={color} label={`${label} ${color}`} onPress={() => choose(color)} />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Fewer" : "More"} ${label.toLowerCase()} options`}
          accessibilityState={{ expanded }}
          style={styles.more}
          onPress={() => setExpanded((open) => !open)}
        >
          <Text style={styles.moreText}>{expanded ? "Less" : "More"}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={12} color={colors.textMuted} />
        </Pressable>
      </View>
      {expanded
        ? buildColorSections(themeColors, recent).map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={type.caption}>{section.label}</Text>
              <View style={styles.row}>
                {section.colors.map((color) => (
                  <Swatch
                    key={color}
                    color={color}
                    selected={sameColor(color, value)}
                    label={`${label} ${color}`}
                    onPress={() => choose(color)}
                  />
                ))}
              </View>
            </View>
          ))
        : null}
    </View>
  );
}

function Swatch({ color, selected, label, onPress }: { color: string; selected?: boolean; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={4}
      style={[styles.swatchRing, selected && styles.swatchRingSelected]}
    >
      <View style={[styles.swatch, { backgroundColor: color }]} />
    </Pressable>
  );
}

const SWATCH = 28;

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  section: { gap: spacing.xs + 2 },
  swatchRing: {
    width: SWATCH + 6,
    height: SWATCH + 6,
    borderRadius: (SWATCH + 6) / 2,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  swatchRingSelected: { borderColor: colors.brand },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: SWATCH + 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted
  },
  moreText: { color: colors.textBody, fontWeight: "600", fontSize: 13 }
});
