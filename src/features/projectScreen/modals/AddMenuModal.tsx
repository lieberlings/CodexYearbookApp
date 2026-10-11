import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import type { ProjectAddIntent } from "../helpers";
import { styles } from "../styles";

export function AddMenuModal({
  addMenuVisible,
  setAddMenuVisible,
  openProjectAddIntent
}: {
  addMenuVisible: boolean;
  setAddMenuVisible: (visible: boolean) => void;
  openProjectAddIntent: (intent: ProjectAddIntent) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={addMenuVisible} onRequestClose={() => setAddMenuVisible(false)}>
      <View style={styles.centerModalBackdrop}>
        <View style={styles.actionMenuCard}>
          <Text style={styles.modalTitle}>Add to Project</Text>
          <Text style={styles.modalSubtitle}>Choose what you want to create or review.</Text>
          <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("memory")}>
            <Ionicons name="images-outline" size={20} color="#4A4239" />
            <View style={styles.actionMenuTextBlock}>
              <Text style={styles.actionMenuButtonText}>Memory</Text>
              <Text style={styles.actionMenuHint}>Create an event memory and add photos.</Text>
            </View>
          </Pressable>
          <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("collection")}>
            <Ionicons name="albums-outline" size={20} color="#4A4239" />
            <View style={styles.actionMenuTextBlock}>
              <Text style={styles.actionMenuButtonText}>Collection</Text>
              <Text style={styles.actionMenuHint}>Create a theme collection with selected photos.</Text>
            </View>
          </Pressable>
          <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("suggestions")}>
            <Ionicons name="sparkles-outline" size={20} color="#4A4239" />
            <View style={styles.actionMenuTextBlock}>
              <Text style={styles.actionMenuButtonText}>Review Suggestions</Text>
              <Text style={styles.actionMenuHint}>Scan, review, snooze, or dismiss suggested memories.</Text>
            </View>
          </Pressable>
          <Pressable style={styles.secondaryButtonLike} onPress={() => setAddMenuVisible(false)}>
            <Text style={styles.secondaryButtonLikeText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
