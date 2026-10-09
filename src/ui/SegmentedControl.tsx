import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "./theme";

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// One choice out of a few, side by side (cover panels, text direction, ...).
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, style }: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.track, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text numberOfLines={1} style={[styles.text, selected && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: spacing.xs, padding: spacing.xs, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  segment: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.sm },
  selected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand },
  text: { color: colors.textBody, fontSize: 13, fontWeight: "600" },
  selectedText: { color: colors.brandText, fontWeight: "700" }
});
