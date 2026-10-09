import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getShapeDefinition, objectShapes } from "../../../layout/objectShapes";
import { PageTextBox, TextBoxAlignment } from "../../../types";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { ColorPicker } from "../../../ui/ColorPicker";
import { SettingRow, Stepper } from "../../../ui/Stepper";
import { colors } from "../../../ui/theme";
import { FONT_FAMILIES, TEXT_BOX_CORNER_RADII } from "../helpers";
import { styles } from "../styles";

/** Formatting controls for the selected text box: font, size, alignment, colors, shape, border and fill. */
export function TextBoxPanel({
  textBox,
  defaultTextColor,
  themeColors,
  fontMenuOpen,
  onFontMenuChange,
  onChange,
  onRevertToPhotoSlot
}: {
  textBox: PageTextBox;
  defaultTextColor: string;
  themeColors: string[];
  fontMenuOpen: boolean;
  onFontMenuChange: (open: boolean) => void;
  onChange: (updates: Partial<PageTextBox>) => void;
  onRevertToPhotoSlot: () => void;
}) {
  return (
    <ScrollView
      style={styles.textCompactToolbarScroll}
      contentContainerStyle={styles.textCompactToolbar}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="none"
      nestedScrollEnabled
    >
      <ScrollView horizontal style={styles.formatBarScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.formatBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose font" accessibilityState={{ expanded: fontMenuOpen }}
          style={styles.fontMenuButton} onPress={() => onFontMenuChange(!fontMenuOpen)}>
          <Text style={styles.fontDropdownText}>{FONT_FAMILIES.find((font) => font.id === textBox.fontFamily)?.label ?? "Sans"}</Text>
          <Ionicons name="chevron-down" size={12} color="#6B6156" />
        </Pressable>
        <Stepper label="Text size" value={textBox.fontSize ?? 26} min={10} max={72} step={2}
          onChange={(fontSize) => onChange({ fontSize })} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Alignment ${textBox.textAlign ?? "center"}; tap to change`}
          style={styles.formatButton}
          onPress={() => {
            const alignments: TextBoxAlignment[] = ["left", "center", "right"];
            onChange({ textAlign: alignments[(alignments.indexOf(textBox.textAlign ?? "center") + 1) % 3] });
          }}>
          <View style={{ gap: 3, width: 18, alignItems: textBox.textAlign === "left" ? "flex-start" : textBox.textAlign === "right" ? "flex-end" : "center" }}>
            {[18, 12, 18].map((lineWidth, index) => <View key={index} style={{ width: lineWidth, height: 2, backgroundColor: colors.textBody }} />)}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Bold" accessibilityState={{ selected: textBox.fontWeight === "700" }}
          style={[styles.formatButton, textBox.fontWeight === "700" && styles.formatButtonSelected]}
          onPress={() => onChange({ fontWeight: textBox.fontWeight === "700" ? "400" : "700" })}>
          <Text style={[styles.toggleChipText, textBox.fontWeight === "700" && styles.formatSelectedText]}>B</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Italic" accessibilityState={{ selected: textBox.fontStyle === "italic" }}
          style={[styles.formatButton, textBox.fontStyle === "italic" && styles.formatButtonSelected]}
          onPress={() => onChange({ fontStyle: textBox.fontStyle === "italic" ? "normal" : "italic" })}>
          <Text style={[styles.toggleChipText, styles.toggleChipItalic, textBox.fontStyle === "italic" && styles.formatSelectedText]}>I</Text>
        </Pressable>
      </ScrollView>
      {fontMenuOpen ? (
        <View style={styles.fontDropdown}>
          {FONT_FAMILIES.map((font) => (
            <Pressable key={font.id} style={[styles.fontDropdownOption, textBox.fontFamily === font.id && styles.fontDropdownOptionActive]}
              onPress={() => { onChange({ fontFamily: font.id }); onFontMenuChange(false); }}>
              <Text style={[styles.fontDropdownText, { fontFamily: font.id === "System" ? undefined : font.id }]}>{font.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ColorPicker
        label="Text color"
        value={textBox.textColor ?? defaultTextColor}
        themeColors={themeColors}
        onChange={(textColor) => onChange({ textColor })}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {objectShapes.map(shape => <Chip key={shape} label={getShapeDefinition(shape).label} selected={(textBox.shape ?? "rectangle") === shape} onPress={() => onChange({ shape })} />)}
      </View>
      <View style={styles.controlGroup}>
        <Text style={styles.controlGroupLabel}>Border</Text>
        <SettingRow label="Width">
          <Stepper label="Text box border width" value={textBox.borderWidth ?? 0} min={0} max={12} step={1}
            onChange={(borderWidth) => onChange({ borderWidth })} />
        </SettingRow>
        <ColorPicker
          label="Border color"
          value={textBox.borderColor ?? "#0f172a"}
          themeColors={themeColors}
          onChange={(borderColor) => onChange({ borderColor })}
        />
        <View style={styles.shapeRow}>
          {TEXT_BOX_CORNER_RADII.map((radius) => (
            <Pressable
              key={radius}
              style={[
                styles.shapeChoice,
                { borderRadius: radius / 2 },
                (textBox.cornerRadius ?? 0) === radius ? styles.shapeChoiceActive : null
              ]}
              onPress={() => onChange({ cornerRadius: radius })}
              accessibilityRole="button"
              accessibilityLabel={`Text box corner radius ${radius}`}
            >
              <Text style={styles.shapeChoiceText}>{radius === 0 ? "Square" : radius}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!textBox.anchorSlotId ? (
        <View style={styles.controlGroup}>
          <Text style={styles.controlGroupLabel}>Fill</Text>
          <ColorPicker
            label="Fill color"
            value={textBox.fillColor ?? "#ffffff"}
            themeColors={themeColors}
            onChange={(fillColor) => onChange({ fillColor })}
          />
          <SettingRow label="Opacity">
            <Stepper label="Fill opacity" value={Math.round((textBox.fillOpacity ?? 0) * 100)} min={0} max={100} step={10}
              format={(percent) => `${percent}%`} onChange={(percent) => onChange({ fillOpacity: percent / 100 })} />
          </SettingRow>
        </View>
      ) : null}

      {textBox.anchorSlotId ? <Button size="sm" icon="image-outline" label="Turn back into photo slot" style={{ alignSelf: "flex-start" }} onPress={onRevertToPhotoSlot} /> : null}
    </ScrollView>
  );
}
