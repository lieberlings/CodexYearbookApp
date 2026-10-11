import type { Dispatch, SetStateAction } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import type { Project } from "../../../types";
import { DEV_TOOLS_ENABLED } from "../devTools/flags";
import { styles } from "../styles";

export function ProjectMenuModal({
  project,
  projectMenuVisible,
  setProjectMenuVisible,
  devToolsExpanded,
  setDevToolsExpanded,
  exporting,
  zipProgress,
  onExportPdf,
  choosePhotoExportScope,
  onChangeProjectCover,
  projectMenuBusy,
  onDeleteProjectFromMenu
}: {
  project: Project;
  projectMenuVisible: boolean;
  setProjectMenuVisible: (visible: boolean) => void;
  devToolsExpanded: boolean;
  setDevToolsExpanded: Dispatch<SetStateAction<boolean>>;
  exporting: boolean;
  zipProgress: string | undefined;
  onExportPdf: () => void;
  choosePhotoExportScope: () => void;
  onChangeProjectCover: () => void;
  projectMenuBusy: boolean;
  onDeleteProjectFromMenu: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={projectMenuVisible} onRequestClose={() => setProjectMenuVisible(false)}>
      <View style={styles.centerModalBackdrop}>
        <View style={styles.actionMenuCard}>
          <Text style={styles.modalTitle}>{project.name}</Text>
          <Text style={styles.modalSubtitle}>Project options</Text>
          {DEV_TOOLS_ENABLED ? (
            <Pressable
              style={styles.actionMenuButton}
              onPress={() => {
                setDevToolsExpanded((prev) => !prev);
                setProjectMenuVisible(false);
              }}
            >
              <Ionicons name="construct-outline" size={20} color="#4A4239" />
              <Text style={styles.actionMenuButtonText}>
                {devToolsExpanded ? "Hide Developer Tools" : "Show Developer Tools"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.actionMenuButton, exporting ? styles.suggestionActionDisabled : null]}
            onPress={onExportPdf}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Export PDF"
          >
            {exporting && !zipProgress ? <ActivityIndicator color="#6B5BD2" /> : <Ionicons name="document-text-outline" size={20} color="#4A4239" />}
            <Text style={styles.actionMenuButtonText}>{exporting && !zipProgress ? "Preparing PDF..." : "Export PDF"}</Text>
          </Pressable>
          <Pressable style={[styles.actionMenuButton, exporting ? styles.suggestionActionDisabled : null]} onPress={choosePhotoExportScope} disabled={exporting}>
            {zipProgress ? <ActivityIndicator color="#6B5BD2" /> : <Ionicons name="download-outline" size={20} color="#4A4239" />}
            <Text style={styles.actionMenuButtonText}>{zipProgress ?? "Export photos (ZIP)"}</Text>
          </Pressable>
          <Pressable style={styles.actionMenuButton} onPress={onChangeProjectCover} disabled={projectMenuBusy}>
            {projectMenuBusy ? (
              <ActivityIndicator color="#4A4239" />
            ) : (
              <Ionicons name="image-outline" size={20} color="#4A4239" />
            )}
            <Text style={styles.actionMenuButtonText}>Change Project Thumbnail</Text>
          </Pressable>
          <Pressable style={[styles.actionMenuButton, styles.actionMenuDanger]} onPress={onDeleteProjectFromMenu}>
            <Ionicons name="trash-outline" size={20} color="#AD432F" />
            <Text style={styles.actionMenuDangerText}>Delete Project</Text>
          </Pressable>
          <Pressable style={styles.secondaryButtonLike} onPress={() => setProjectMenuVisible(false)}>
            <Text style={styles.secondaryButtonLikeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
