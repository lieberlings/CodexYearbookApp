import type { Dispatch, ReactElement, SetStateAction } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import type { useAppData } from "../../../context/AppContext";
import type { ProjectPhotoCluster } from "../../../services/projectClusterEngine";
import type { PhotoItem, Project } from "../../../types";
import { pluralize, StatusCard } from "../helpers";
import { styles } from "../styles";

export function DevToolsSection({
  openAnalysisInspector,
  openMediaLibraryPicker,
  projectPhotoIntakeBusy,
  onAddProjectPhotos,
  project,
  projectPhotos,
  unassignedProjectPhotos,
  updateProject,
  projectPhotoStateCard,
  projectPhotoPreview,
  clusterAnalysisBusy,
  analyzeAllProjectPhotosForClusters,
  setClusterInspectorExpanded,
  clusterInspectorExpanded,
  projectClusters,
  clusterAnalysisFeedback,
  topProjectClusters,
  renderClusterCard
}: {
  openAnalysisInspector: (photoId?: string) => void;
  openMediaLibraryPicker: () => void;
  projectPhotoIntakeBusy: boolean;
  onAddProjectPhotos: () => void;
  project: Project;
  projectPhotos: PhotoItem[];
  unassignedProjectPhotos: PhotoItem[];
  updateProject: ReturnType<typeof useAppData>["updateProject"];
  projectPhotoStateCard: StatusCard | undefined;
  projectPhotoPreview: PhotoItem[];
  clusterAnalysisBusy: boolean;
  analyzeAllProjectPhotosForClusters: () => Promise<void>;
  setClusterInspectorExpanded: Dispatch<SetStateAction<boolean>>;
  clusterInspectorExpanded: boolean;
  projectClusters: ProjectPhotoCluster[];
  clusterAnalysisFeedback: StatusCard | undefined;
  topProjectClusters: ProjectPhotoCluster[];
  renderClusterCard: (cluster: ProjectPhotoCluster) => ReactElement;
}) {
  return (
    <View style={styles.devToolsSection}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionHeading}>Developer Tools</Text>
          <Text style={styles.sectionSubheading}>
            Internal photo-pool, analysis, and clustering tools are hidden from the normal MVP flow.
          </Text>
        </View>
      </View>
      <>
  <View style={[styles.sectionHeaderRow, styles.sectionHeaderRowStack]}>
    <Text style={styles.sectionHeading}>Project Photos</Text>
    <View style={[styles.sectionHeaderActions, styles.sectionHeaderActionsFullWidth]}>
      <Pressable style={styles.dismissedToggle} onPress={() => openAnalysisInspector()}>
        <Ionicons name="bug-outline" size={15} color="#6B6156" />
        <Text style={styles.dismissedToggleText}>Analysis Inspector</Text>
      </Pressable>
      <Pressable style={styles.dismissedToggle} onPress={openMediaLibraryPicker}>
        <Ionicons name="albums-outline" size={15} color="#6B6156" />
        <Text style={styles.dismissedToggleText}>Probe Media Asset</Text>
      </Pressable>
      <Pressable
        style={[styles.scanButton, projectPhotoIntakeBusy ? styles.scanButtonDisabled : null]}
        onPress={onAddProjectPhotos}
        disabled={projectPhotoIntakeBusy}
      >
        {projectPhotoIntakeBusy ? (
          <ActivityIndicator color="#4A4239" size="small" />
        ) : (
          <>
            <Ionicons name="images-outline" size={15} color="#4A4239" />
            <Text style={styles.scanButtonText}>Add Photos to Project</Text>
          </>
        )}
      </Pressable>
    </View>
  </View>
  <Text style={styles.sectionSubheading}>
    Photos added here stay in the project pool without being assigned to a memory until you use them.
  </Text>
  <Text style={styles.suggestionSummary}>
    {pluralize(projectPhotos.length, "project photo")} · {pluralize(unassignedProjectPhotos.length, "unassigned photo")}
  </Text>
  {project && project.timelineMode !== "past" ? (
    <View style={styles.projectPoolControlRow}>
      <Text style={styles.projectPoolControlText}>
        Future intake is {project.includeFutureProjectPhotos ? "on" : "paused"} for this {project.timelineMode} project.
      </Text>
      <Pressable
        style={styles.dismissedToggle}
        onPress={() =>
          updateProject(project.id, {
            includeFutureProjectPhotos: !project.includeFutureProjectPhotos
          })
        }
      >
        <Ionicons
          name={project.includeFutureProjectPhotos ? "flash-outline" : "pause-outline"}
          size={15}
          color="#6B6156"
        />
        <Text style={styles.dismissedToggleText}>
          {project.includeFutureProjectPhotos ? "Pause Future Intake" : "Include Future Photos"}
        </Text>
      </Pressable>
    </View>
  ) : null}
  {projectPhotoStateCard ? (
    <View
      style={[
        styles.suggestionsStateCard,
        projectPhotoStateCard.tone === "error" ? styles.suggestionsStateCardError : null,
        projectPhotoStateCard.tone === "info" ? styles.suggestionsStateCardInfo : null,
        projectPhotoStateCard.tone === "success" ? styles.suggestionsStateCardSuccess : null
      ]}
    >
      <Ionicons
        name={projectPhotoStateCard.icon}
        size={24}
        color={projectPhotoStateCard.tone === "error" ? "#AD432F" : projectPhotoStateCard.tone === "success" ? "#327558" : "#6B5BD2"}
      />
      <Text style={styles.emptyTitle}>{projectPhotoStateCard.title}</Text>
      <Text style={styles.emptyText}>{projectPhotoStateCard.message}</Text>
    </View>
  ) : null}
  {projectPhotoPreview.length > 0 ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.projectPhotoStrip}
    >
      {projectPhotoPreview.map((photo) => (
        <Pressable key={photo.id} style={styles.projectPhotoThumbWrap} onPress={() => openAnalysisInspector(photo.id)}>
          <Image source={{ uri: photo.uri }} style={styles.projectPhotoThumb} />
        </Pressable>
      ))}
    </ScrollView>
  ) : null}

  <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionHeading}>Cluster Inspector</Text>
    <View style={styles.sectionControlRow}>
      <Pressable
        style={[styles.dismissedToggle, clusterAnalysisBusy ? styles.scanButtonDisabled : null]}
        onPress={() => void analyzeAllProjectPhotosForClusters()}
        disabled={clusterAnalysisBusy}
      >
        {clusterAnalysisBusy ? (
          <ActivityIndicator color="#6B6156" size="small" />
        ) : (
          <Ionicons name="analytics-outline" size={15} color="#6B6156" />
        )}
        <Text style={styles.dismissedToggleText}>
          {clusterAnalysisBusy ? "Analyzing..." : "Analyze All"}
        </Text>
      </Pressable>
      <Pressable style={styles.dismissedToggle} onPress={() => setClusterInspectorExpanded((prev) => !prev)}>
        <Ionicons
          name={clusterInspectorExpanded ? "chevron-up-outline" : "chevron-down-outline"}
          size={15}
          color="#6B6156"
        />
        <Text style={styles.dismissedToggleText}>
          {clusterInspectorExpanded
            ? `Collapse clusters (${projectClusters.length})`
            : `Expand clusters (${projectClusters.length})`}
        </Text>
      </Pressable>
    </View>
  </View>
  <Text style={styles.sectionSubheading}>
    Developer-only grouping preview for event-like moments and recurring collection candidates. This does not create memories or suggestions.
  </Text>
  <Text style={styles.suggestionSummary}>
    Vocabulary: time-burst, same-day, multi-day, location, faces, quality, scenic, food, pet, travel, recurring-theme.
  </Text>
  {clusterAnalysisFeedback ? (
    <View
      style={[
        styles.suggestionsStateCard,
        clusterAnalysisFeedback.tone === "error" ? styles.suggestionsStateCardError : null,
        clusterAnalysisFeedback.tone === "info" ? styles.suggestionsStateCardInfo : null,
        clusterAnalysisFeedback.tone === "success" ? styles.suggestionsStateCardSuccess : null
      ]}
    >
      {clusterAnalysisBusy ? (
        <ActivityIndicator color="#4A4239" />
      ) : (
        <Ionicons
          name={clusterAnalysisFeedback.icon}
          size={24}
          color={
            clusterAnalysisFeedback.tone === "error"
              ? "#AD432F"
              : clusterAnalysisFeedback.tone === "success"
                ? "#327558"
                : "#6B5BD2"
          }
        />
      )}
      <Text style={styles.emptyTitle}>{clusterAnalysisFeedback.title}</Text>
      <Text style={styles.emptyText}>{clusterAnalysisFeedback.message}</Text>
    </View>
  ) : null}
  {clusterInspectorExpanded && projectClusters.length === 0 ? (
    <View style={styles.suggestionsEmptyCard}>
      <Ionicons name="git-branch-outline" size={28} color="#6B6156" />
      <Text style={styles.emptyTitle}>No strong clusters yet</Text>
      <Text style={styles.emptyText}>
        Add or analyze more project photos. The first pass needs close time groups or repeated themes across days.
      </Text>
    </View>
  ) : null}
  {clusterInspectorExpanded && topProjectClusters.length > 0 ? (
    <View style={styles.suggestionList}>{topProjectClusters.map(renderClusterCard)}</View>
  ) : null}
      </>
    </View>
  );
}
