import { Modal, Pressable, Text, TextInput, View } from "react-native";
import type { Memory } from "../../../types";
import { MemoryComposerOptions, SUGGESTED_THEME_PAGE_LABELS } from "../helpers";
import { styles } from "../styles";

export function ThemePickerModal({
  themePickerVisible,
  setThemePickerVisible,
  openThemePhotoPicker,
  customThemeLabel,
  setCustomThemeLabel,
  openCreateComposer
}: {
  themePickerVisible: boolean;
  setThemePickerVisible: (visible: boolean) => void;
  openThemePhotoPicker: (label: string) => Promise<void>;
  customThemeLabel: string;
  setCustomThemeLabel: (label: string) => void;
  openCreateComposer: (kind?: Memory["kind"], options?: MemoryComposerOptions) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={themePickerVisible} onRequestClose={() => setThemePickerVisible(false)}>
      <View style={styles.centerModalBackdrop}>
        <View style={styles.actionMenuCard}>
          <Text style={styles.modalTitle}>Choose Theme</Text>
          <Text style={styles.modalSubtitle}>
            Pick a suggested theme or enter your own. The next step lets you choose exact photos.
          </Text>
          <View style={styles.themeChipRow}>
            {SUGGESTED_THEME_PAGE_LABELS.map((label) => (
              <Pressable key={label} style={styles.themeChip} onPress={() => void openThemePhotoPicker(label)}>
                <Text style={styles.themeChipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Custom Theme</Text>
          <TextInput
            value={customThemeLabel}
            onChangeText={setCustomThemeLabel}
            placeholder="Examples: Christmas, desserts, grandparents"
            placeholderTextColor="#6B6156"
            style={styles.modalInput}
          />
          <Pressable
            style={[styles.primaryAction, !customThemeLabel.trim() ? styles.primaryActionDisabled : null]}
            onPress={() => void openThemePhotoPicker(customThemeLabel)}
            disabled={!customThemeLabel.trim()}
          >
            <Text style={styles.primaryActionText}>Select Photos</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButtonLike}
            onPress={() => {
              setThemePickerVisible(false);
              openCreateComposer("collection");
            }}
          >
            <Text style={styles.secondaryButtonLikeText}>Blank Collection</Text>
          </Pressable>
          <Pressable style={styles.secondaryButtonLike} onPress={() => setThemePickerVisible(false)}>
            <Text style={styles.secondaryButtonLikeText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
