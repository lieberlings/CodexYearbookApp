import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "./theme";

type ButtonVariant = "primary" | "secondary" | "danger" | "link";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: ComponentProps<typeof Ionicons>["name"];
  // Shown instead of an Ionicons glyph, e.g. an emoji.
  leading?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const foreground: Record<ButtonVariant, string> = {
  primary: colors.onBrand,
  secondary: colors.brandText,
  danger: colors.onBrand,
  link: colors.brand
};

// The one button used across the app. Pick the variant by importance:
// primary for the main action on a screen, secondary for the rest,
// danger for destructive confirmations, link for low-key inline actions.
export function Button({ label, onPress, variant = "secondary", size = "md", icon, leading, disabled, busy, accessibilityLabel, style }: ButtonProps) {
  const color = foreground[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        styles[variant],
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
        style
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {leading}
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={color} /> : null}
          <Text numberOfLines={1} style={[styles.label, size === "sm" && styles.labelSm, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 2,
    borderRadius: radii.pill
  },
  md: { minHeight: 44, paddingHorizontal: spacing.lg },
  sm: { minHeight: 36, paddingHorizontal: spacing.md },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.brandSoft },
  danger: { backgroundColor: colors.danger },
  link: { backgroundColor: "transparent", paddingHorizontal: spacing.xs, alignSelf: "flex-start" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 14, fontWeight: "700" },
  labelSm: { fontSize: 13 }
});
