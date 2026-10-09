import { Pressable, ScrollView, Text, View } from "react-native";
import { listAllTemplates } from "../../../layout/templates";
import { Button } from "../../../ui/Button";
import { MiniTemplatePreview } from "../EditorControls";
import { groupTemplatesByPhotoCount } from "../helpers";
import { styles } from "../styles";

export function LayoutPanel({
  freestyle,
  templateId,
  onFreestyle,
  onChangeTemplate
}: {
  freestyle: boolean;
  templateId?: string;
  onFreestyle: () => void;
  onChangeTemplate: (templateId: string | undefined) => void;
}) {
  const templateGroups = groupTemplatesByPhotoCount(listAllTemplates());
  return (
    <ScrollView
      style={styles.layoutPickerScroll}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      contentContainerStyle={styles.layoutPicker}
    >
      <Button variant={freestyle ? "primary" : "secondary"} icon="move" label="Freestyle" style={{ alignSelf: "flex-start" }} onPress={onFreestyle} />
      <View style={styles.controlGroup}>
        <Text style={styles.controlGroupLabel}>Automatic</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
          <Pressable
            style={[styles.templateChoice, !templateId ? styles.templateChoiceActive : null]}
            onPress={() => onChangeTemplate(undefined)}
          >
            <Text style={styles.templateChoiceLabel}>Auto</Text>
          </Pressable>
        </ScrollView>
      </View>
      {templateGroups.map((group) => (
        <View key={group.photoCount} style={styles.controlGroup}>
          <Text style={styles.controlGroupLabel}>
            {group.photoCount} {group.photoCount === 1 ? "Photo" : "Photos"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
            {group.templates.map((template) => {
              const active = templateId === template.id;
              return (
                <Pressable
                  key={template.id}
                  style={[styles.templateChoice, active ? styles.templateChoiceActive : null]}
                  onPress={() => onChangeTemplate(template.id)}
                >
                  <MiniTemplatePreview template={template} active={active} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}
