import { Ionicons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";
import type { PhotoItem } from "../../../types";
import { styles } from "../styles";

export function MemoryCollagePreview({ photos, thumbnailUri }: { photos: PhotoItem[]; thumbnailUri?: string }) {
  if (thumbnailUri) {
    return (
      <View style={styles.previewPanel}>
        <Image source={{ uri: thumbnailUri }} style={styles.previewSingle} />
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={[styles.previewPanel, styles.previewEmpty]}>
        <Ionicons name="images-outline" size={34} color="#6B6156" />
        <Text style={styles.previewEmptyText}>Add photos inside the memory</Text>
      </View>
    );
  }

  if (photos.length === 1) {
    return (
      <View style={styles.previewPanel}>
        <Image source={{ uri: photos[0]?.uri }} style={styles.previewSingle} />
      </View>
    );
  }

  if (photos.length === 2) {
    return (
      <View style={styles.previewPanel}>
        <View style={styles.previewRow}>
          {photos.slice(0, 2).map((photo) => (
            <Image key={photo.id} source={{ uri: photo.uri }} style={styles.previewHalf} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.previewPanel}>
      <View style={styles.previewRow}>
        {photos.slice(0, 3).map((photo, index) => {
          const remaining = photos.length - 3;
          const isOverflow = index === 2 && remaining > 0;
          return (
            <View key={photo.id} style={styles.previewThirdWrap}>
              <Image source={{ uri: photo.uri }} style={styles.previewThird} />
              {isOverflow ? (
                <View style={styles.previewOverlay}>
                  <Text style={styles.previewOverlayText}>{`+${remaining}`}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
