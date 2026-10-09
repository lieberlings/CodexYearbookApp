import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, type } from "./theme";

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
};

// Minus / value / plus, for every numeric setting (sizes, widths, opacity).
export function Stepper({ label, value, min, max, step, onChange, format = String }: StepperProps) {
  const shown = format(value);
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} disabled={value <= min}
        style={[styles.button, value <= min && styles.disabled]} onPress={() => onChange(Math.max(min, value - step))}>
        <Ionicons name="remove" size={16} color={colors.textBody} />
      </Pressable>
      <Text accessibilityLabel={`${label}: ${shown}`} style={styles.value}>{shown}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} disabled={value >= max}
        style={[styles.button, value >= max && styles.disabled]} onPress={() => onChange(Math.min(max, value + step))}>
        <Ionicons name="add" size={16} color={colors.textBody} />
      </Pressable>
    </View>
  );
}

// A labelled row with the control on the right.
export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={type.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: radii.sm + 2 },
  button: { width: 32, height: 36, alignItems: "center", justifyContent: "center" },
  value: { color: colors.text, minWidth: 34, textAlign: "center", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.3 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }
});
