import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { PageBackground } from "../../components/PageBackground";
import { TemplateDefinition } from "../../layout/templates";
import { styles } from "./styles";

type ToolIconName = ComponentProps<typeof Ionicons>["name"];

export function MiniTemplatePreview({ template, active }: { template: TemplateDefinition; active: boolean }) {
  return (
    <View style={[styles.templateMiniCard, active ? styles.templateMiniCardActive : null]}>
      {template.slots.map((slot) => (
        <View
          key={slot.id}
          style={[
            styles.templateMiniBlock,
            slot.role === "hero" ? styles.templateMiniHero : null,
            {
              left: `${slot.frame.x * 100}%`,
              top: `${slot.frame.y * 100}%`,
              width: `${slot.frame.width * 100}%`,
              height: `${slot.frame.height * 100}%`,
            }
          ]}
        />
      ))}
    </View>
  );
}

export function IconOrb({
  label,
  icon,
  active,
  onPress
}: {
  label: string;
  icon: ToolIconName;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.iconOrb, active ? styles.iconOrbActive : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
    >
      <Ionicons name={icon} size={22} color={active ? "#ffffff" : "#4A4239"} />
      <Text style={[styles.iconOrbLabel, active ? styles.iconOrbLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function BackgroundThumbnail({
  assetId,
  backgroundColor,
  active,
  label,
  onPress
}: {
  assetId?: string;
  backgroundColor?: string;
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.backgroundChoice}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.backgroundChoicePreview, active ? styles.backgroundChoicePreviewActive : null]}>
        <PageBackground backgroundAssetId={assetId} backgroundColor={backgroundColor} />
      </View>
      <Text numberOfLines={1} style={[styles.backgroundChoiceLabel, active ? styles.backgroundChoiceLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}
