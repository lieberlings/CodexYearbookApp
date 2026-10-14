import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { ProjectAccess } from "../../cloud/CloudContext";
import { requestMemoryControl } from "../../cloud/sharing";
import { Button } from "../../ui/Button";
import { colors, radii, spacing } from "../../ui/theme";
import { errorMessage } from "./styles";

type Props = {
  access: ProjectAccess;
  projectId: string;
  memoryId: string;
  controllerName?: string;
  onAddPhotos: () => void;
};

// Shown in the memory editor when someone else edits this memory's pages.
// Contributors can still add photos and ask to take over editing.
export function SharedMemoryBanner({ access, projectId, memoryId, controllerName, onAddPhotos }: Props) {
  const [asked, setAsked] = useState(false);
  const message = access.accessRemoved
    ? "You no longer have access to this project. This copy won't update."
    : access.role === "viewer"
      ? "You can look at this memory but not change it."
      : `${controllerName ?? "Someone else"} is editing this memory's pages. You can add photos; they choose where they go.`;
  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.brandText} />
        <Text style={styles.text}>{message}</Text>
      </View>
      {access.canAddPhotos ? (
        <View style={styles.row}>
          <Button label="Add photos" size="sm" icon="images-outline" onPress={onAddPhotos} />
          <Button
            label={asked ? "Asked" : "Ask to edit"}
            size="sm"
            variant="link"
            disabled={asked}
            onPress={() =>
              void requestMemoryControl(projectId, memoryId)
                .then(() => setAsked(true))
                .catch((error) => Alert.alert("Couldn't send the request", errorMessage(error)))
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.brandSoft
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  text: { flex: 1, color: colors.brandText, fontSize: 13, lineHeight: 18 }
});
