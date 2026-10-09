import { ScrollView } from "react-native";
import { ColorPicker } from "../../../ui/ColorPicker";
import { SettingRow, Stepper } from "../../../ui/Stepper";
import { styles } from "../styles";

export type PhotoBorderStyle = { slotBorderColor?: string; slotBorderWidth?: number; slotCornerRadius?: number };

export function BordersPanel({
  value,
  themeColors,
  onChange
}: {
  value: PhotoBorderStyle;
  themeColors: string[];
  onChange: (change: PhotoBorderStyle) => void;
}) {
  return (
    <ScrollView style={styles.toolContentScroll} contentContainerStyle={styles.borderControls}>
      <ColorPicker
        label="Border color"
        value={value.slotBorderColor}
        themeColors={themeColors}
        onChange={(slotBorderColor) => onChange({ slotBorderColor })}
      />
      <SettingRow label="Width">
        <Stepper label="Border width" value={value.slotBorderWidth ?? 1} min={0} max={12} step={1}
          onChange={(slotBorderWidth) => onChange({ slotBorderWidth })} />
      </SettingRow>
      <SettingRow label="Corners">
        <Stepper label="Corner radius" value={value.slotCornerRadius ?? 0} min={0} max={28} step={2}
          onChange={(slotCornerRadius) => onChange({ slotCornerRadius })} />
      </SettingRow>
    </ScrollView>
  );
}
