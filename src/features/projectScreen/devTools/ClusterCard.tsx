import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { ProjectPhotoCluster } from "../../../services/projectClusterEngine";
import type { PhotoItem } from "../../../types";
import { formatClusterLocation, formatClusterTimeRange, getClusterTypeLabel, pluralize } from "../helpers";
import { styles } from "../styles";

export function ClusterCard({
  cluster,
  projectPhotos,
  openAnalysisInspector
}: {
  cluster: ProjectPhotoCluster;
  projectPhotos: PhotoItem[];
  openAnalysisInspector: (photoId?: string) => void;
}) {
  const bestPhotos = cluster.bestPhotoIds
    .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
    .filter((photo): photo is PhotoItem => Boolean(photo))
    .slice(0, 4);

  return (
    <View key={cluster.id} style={styles.clusterCard}>
      <View style={styles.suggestionCardHeader}>
        <Text style={styles.suggestionTitle}>{getClusterTypeLabel(cluster.type)}</Text>
        <View style={[styles.suggestionStatusBadge, styles.clusterScoreBadge]}>
          <Text style={[styles.suggestionStatusText, styles.clusterScoreText]}>{cluster.score}</Text>
        </View>
      </View>
      <Text style={styles.suggestionMessage}>{cluster.explanation}</Text>
      <Text style={styles.suggestionMeta}>
        {formatClusterTimeRange(cluster)} · {pluralize(cluster.photoCount, "photo")} |{" "}
        {pluralize(cluster.bestPhotoIds.length, "best pick")}
      </Text>
      <Text style={styles.suggestionLifecycleNote}>{formatClusterLocation(cluster)}</Text>
      <Text style={styles.suggestionLifecycleNote}>
        Quality avg {cluster.qualitySummary.averageQuality} / best {cluster.qualitySummary.bestQuality} |{" "}
        {cluster.faceSummary.facePhotoCount} face photos, {cluster.faceSummary.groupPhotoCount} group photos
      </Text>
      <Text style={styles.suggestionMeta}>
        Cues: {cluster.cues.length > 0 ? cluster.cues.join(", ") : "none"}{"\n"}
        Tags: {cluster.supportingTags.length > 0 ? cluster.supportingTags.join(", ") : "none"}
      </Text>
      {cluster.recurrence ? (
        <Text style={styles.suggestionLifecycleNote}>
          Recurs across {cluster.recurrence.distinctDays} days over {cluster.recurrence.spanDays} days.
        </Text>
      ) : null}
      {bestPhotos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clusterBestPhotoRow}>
          {bestPhotos.map((photo) => (
            <Pressable key={photo.id} style={styles.clusterBestPhoto} onPress={() => openAnalysisInspector(photo.id)}>
              <Image source={{ uri: photo.uri }} style={styles.clusterBestPhotoImage} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
