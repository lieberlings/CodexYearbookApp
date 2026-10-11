import { ReactNode } from "react";
import { Text, View } from "react-native";
import { styles } from "../styles";
import { formatInspectorValue, InspectorFieldValue } from "./inspector";

export function InspectorField({ label, value }: { label: string; value: InspectorFieldValue }) {
  return (
    <View style={styles.analysisFieldRow}>
      <Text style={styles.analysisFieldLabel}>{label}</Text>
      <Text selectable style={styles.analysisFieldValue}>
        {formatInspectorValue(value)}
      </Text>
    </View>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.analysisSection}>
      <Text style={styles.analysisSectionTitle}>{title}</Text>
      <View style={styles.analysisSectionBody}>{children}</View>
    </View>
  );
}
