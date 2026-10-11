import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { detectPhotoFacesHeuristic } from "../../../services/faceDetectionService";
import type { NativeFaceDetectionResult } from "../../../services/nativeFaceDetection";
import type { NativeImageLabelingResult } from "../../../services/nativeImageLabeling";
import type { MediaLibraryAssetProbe } from "../../../services/photoService";
import { analyzePhotoSceneHeuristics, normalizeTagsFromNativeImageLabels } from "../../../services/sceneAnalysisService";
import type { PhotoItem } from "../../../types";
import type { StatusCard } from "../helpers";
import { styles } from "../styles";
import { DEV_TOOLS_ENABLED } from "./flags";
import {
  formatAnalysisSource,
  formatLocationLabel,
  formatNativeFaceProbe,
  formatNativeFaces,
  formatNativeLabelProbe,
  formatNativeLabels,
  formatResolutionKind,
  formatTagList,
  getCapturedAtSourceLabel,
  getLocationSourceLabel
} from "./inspector";
import { InspectorField, InspectorSection } from "./InspectorFields";

export function AnalysisInspectorModal({
  analysisInspectorVisible,
  closeAnalysisInspector,
  analysisInspectorBusy,
  inspectorSelectablePhotos,
  selectedInspectorPhoto,
  setAnalysisInspectorPhotoId,
  analysisInspectorFeedback,
  setAnalysisInspectorFeedback,
  runInspectorAnalysis,
  inspectorDebugReport,
  logInspectorDebugReport,
  analysisInspectorProbe,
  analysisInspectorProbeBusy,
  heuristicScenePreview,
  heuristicFacePreview,
  nativeLabelProbe,
  nativeLabelProbeBusy,
  nativeFaceProbe,
  nativeFaceProbeBusy
}: {
  analysisInspectorVisible: boolean;
  closeAnalysisInspector: () => void;
  analysisInspectorBusy: boolean;
  inspectorSelectablePhotos: PhotoItem[];
  selectedInspectorPhoto: PhotoItem | null;
  setAnalysisInspectorPhotoId: (photoId: string | null) => void;
  analysisInspectorFeedback: StatusCard | undefined;
  setAnalysisInspectorFeedback: (feedback: StatusCard | undefined) => void;
  runInspectorAnalysis: (force: boolean) => void;
  inspectorDebugReport: string;
  logInspectorDebugReport: () => void;
  analysisInspectorProbe: MediaLibraryAssetProbe | null;
  analysisInspectorProbeBusy: boolean;
  heuristicScenePreview: ReturnType<typeof analyzePhotoSceneHeuristics> | undefined;
  heuristicFacePreview: ReturnType<typeof detectPhotoFacesHeuristic> | undefined;
  nativeLabelProbe: NativeImageLabelingResult | null;
  nativeLabelProbeBusy: boolean;
  nativeFaceProbe: NativeFaceDetectionResult | null;
  nativeFaceProbeBusy: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      animationType="slide"
      visible={DEV_TOOLS_ENABLED && analysisInspectorVisible}
      onRequestClose={closeAnalysisInspector}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalAvoider}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Image Analysis Inspector</Text>
                <Text style={styles.modalSubtitle}>
                  Developer-facing view of one photo’s persisted analysis metadata. It uses the current orchestrator
                  and updates the live project photo record.
                </Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={closeAnalysisInspector} disabled={analysisInspectorBusy}>
                <Ionicons name="close" size={22} color="#4A4239" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {inspectorSelectablePhotos.length > 0 ? (
                <View style={styles.analysisPickerSection}>
                  <Text style={styles.fieldLabel}>Target Photo</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.analysisPickerRow}
                  >
                    {inspectorSelectablePhotos.map((photo) => {
                      const selected = selectedInspectorPhoto?.id === photo.id;
                      return (
                        <Pressable
                          key={photo.id}
                          style={[styles.analysisPickerCard, selected ? styles.analysisPickerCardSelected : null]}
                          onPress={() => {
                            setAnalysisInspectorPhotoId(photo.id);
                            setAnalysisInspectorFeedback(undefined);
                          }}
                        >
                          <Image source={{ uri: photo.uri }} style={styles.analysisPickerImage} />
                          <View style={styles.analysisPickerMeta}>
                            <Text style={styles.analysisPickerMetaText}>
                              {photo.memoryId ? "Assigned" : "Project pool"}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="images-outline" size={30} color="#6B6156" />
                  <Text style={styles.emptyTitle}>No project photos to inspect</Text>
                  <Text style={styles.emptyText}>
                    Add project photos or memory photos in this project first, then reopen the inspector.
                  </Text>
                </View>
              )}

              {analysisInspectorFeedback ? (
                <View
                  style={[
                    styles.suggestionsStateCard,
                    analysisInspectorFeedback.tone === "error" ? styles.suggestionsStateCardError : null,
                    analysisInspectorFeedback.tone === "info" ? styles.suggestionsStateCardInfo : null,
                    analysisInspectorFeedback.tone === "success" ? styles.suggestionsStateCardSuccess : null
                  ]}
                >
                  {analysisInspectorBusy ? (
                    <ActivityIndicator color="#4A4239" />
                  ) : (
                    <Ionicons
                      name={analysisInspectorFeedback.icon}
                      size={24}
                      color={
                        analysisInspectorFeedback.tone === "error"
                          ? "#AD432F"
                          : analysisInspectorFeedback.tone === "success"
                            ? "#327558"
                            : "#6B5BD2"
                      }
                    />
                  )}
                  <Text style={styles.emptyTitle}>{analysisInspectorFeedback.title}</Text>
                  <Text style={styles.emptyText}>{analysisInspectorFeedback.message}</Text>
                </View>
              ) : null}

              {selectedInspectorPhoto ? (
                <>
                  <View style={styles.analysisPreviewCard}>
                    <Image source={{ uri: selectedInspectorPhoto.uri }} style={styles.analysisPreviewImage} />
                  </View>

                  <View style={styles.analysisActionRow}>
                    <Pressable
                      style={[styles.scanButton, analysisInspectorBusy ? styles.scanButtonDisabled : null]}
                      onPress={() => runInspectorAnalysis(false)}
                      disabled={analysisInspectorBusy}
                    >
                      {analysisInspectorBusy ? (
                        <ActivityIndicator color="#4A4239" size="small" />
                      ) : (
                        <>
                          <Ionicons name="analytics-outline" size={15} color="#4A4239" />
                          <Text style={styles.scanButtonText}>Analyze Selected</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.dismissedToggle, analysisInspectorBusy ? styles.scanButtonDisabled : null]}
                      onPress={() => runInspectorAnalysis(true)}
                      disabled={analysisInspectorBusy}
                    >
                      <Ionicons name="refresh-outline" size={15} color="#6B6156" />
                      <Text style={styles.dismissedToggleText}>Force Reanalyze</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.dismissedToggle, !inspectorDebugReport ? styles.scanButtonDisabled : null]}
                      onPress={logInspectorDebugReport}
                      disabled={!inspectorDebugReport}
                    >
                      <Ionicons name="terminal-outline" size={15} color="#6B6156" />
                      <Text style={styles.dismissedToggleText}>Log Report</Text>
                    </Pressable>
                  </View>

                  <InspectorSection title="Base Metadata">
                    <InspectorField label="Photo ID" value={selectedInspectorPhoto.id} />
                    <InspectorField label="Project ID" value={selectedInspectorPhoto.projectId} />
                    <InspectorField label="Memory ID" value={selectedInspectorPhoto.memoryId} />
                    <InspectorField label="Source Asset ID" value={selectedInspectorPhoto.importMetadata?.assetId} />
                    <InspectorField label="URI" value={selectedInspectorPhoto.uri} />
                    <InspectorField label="Width" value={selectedInspectorPhoto.width} />
                    <InspectorField label="Height" value={selectedInspectorPhoto.height} />
                    <InspectorField label="Captured At" value={selectedInspectorPhoto.capturedAt} />
                    <InspectorField label="Added At" value={selectedInspectorPhoto.addedAt} />
                    <InspectorField label="Location" value={formatLocationLabel(selectedInspectorPhoto)} />
                  </InspectorSection>

                  <InspectorSection title="Import Metadata Sources">
                    <InspectorField
                      label="Resolution Path"
                      value={formatResolutionKind(selectedInspectorPhoto.importMetadata?.resolutionKind)}
                    />
                    <InspectorField
                      label="Picker Asset ID Present"
                      value={selectedInspectorPhoto.importMetadata?.pickerAssetIdPresent}
                    />
                    <InspectorField
                      label="Picker EXIF Present"
                      value={selectedInspectorPhoto.importMetadata?.pickerExifPresent}
                    />
                    <InspectorField
                      label="Picker Key Sample"
                      value={selectedInspectorPhoto.importMetadata?.pickerKeySample?.join(", ")}
                    />
                    <InspectorField
                      label="Captured At Source"
                      value={getCapturedAtSourceLabel(selectedInspectorPhoto)}
                    />
                    <InspectorField
                      label="Location Source"
                      value={getLocationSourceLabel(selectedInspectorPhoto)}
                    />
                  </InspectorSection>

                  <InspectorSection title="Media Library Probe">
                    <InspectorField
                      label="Picker Asset ID"
                      value={selectedInspectorPhoto.importMetadata?.assetId ?? "No assetId on picker result"}
                    />
                    <InspectorField
                      label="Media Library Lookup"
                      value={
                        analysisInspectorProbeBusy
                          ? "Checking..."
                          : analysisInspectorProbe?.lookupAttempted
                            ? "Called getAssetInfoAsync"
                            : analysisInspectorProbe?.assetIdPresent
                              ? analysisInspectorProbe?.permissionGranted
                                ? "Asset ID present, lookup not completed"
                                : "Permission unavailable"
                              : "Skipped (no assetId)"
                      }
                    />
                    <InspectorField
                      label="AssetInfo Location Present"
                      value={analysisInspectorProbeBusy ? "Checking..." : analysisInspectorProbe?.hasLocation}
                    />
                    <InspectorField
                      label="AssetInfo EXIF Present"
                      value={analysisInspectorProbeBusy ? "Checking..." : analysisInspectorProbe?.hasExif}
                    />
                    <InspectorField
                      label="Final Stored Location"
                      value={formatLocationLabel(selectedInspectorPhoto)}
                    />
                    <InspectorField
                      label="Location Source Used"
                      value={getLocationSourceLabel(selectedInspectorPhoto)}
                    />
                    <InspectorField
                      label="Raw Location Preview"
                      value={analysisInspectorProbeBusy ? "Checking..." : analysisInspectorProbe?.rawLocationPreview}
                    />
                    <InspectorField
                      label="EXIF Key Sample"
                      value={analysisInspectorProbe?.exifKeySample?.join(", ")}
                    />
                    <InspectorField label="Probe Error" value={analysisInspectorProbe?.error} />
                  </InspectorSection>

                  <InspectorSection title="Analysis">
                    <InspectorField label="Analysis Version" value={selectedInspectorPhoto.analysis?.analysisVersion} />
                    <InspectorField label="Analyzed At" value={selectedInspectorPhoto.analysis?.analyzedAt} />
                  </InspectorSection>

                  <InspectorSection title="Quality">
                    <InspectorField label="Quality Score" value={selectedInspectorPhoto.analysis?.quality?.qualityScore} />
                    <InspectorField
                      label="Hero Candidate Score"
                      value={selectedInspectorPhoto.analysis?.quality?.heroCandidateScore}
                    />
                    <InspectorField label="Is Blurry" value={selectedInspectorPhoto.analysis?.quality?.isBlurry} />
                    <InspectorField label="Is Low Light" value={selectedInspectorPhoto.analysis?.quality?.isLowLight} />
                  </InspectorSection>

                  <InspectorSection title="Scene and Theme">
                    <InspectorField
                      label="Persisted Source"
                      value={formatAnalysisSource(selectedInspectorPhoto.analysis?.sources?.scene)}
                    />
                    <InspectorField
                      label="Scene Tags"
                      value={formatTagList(selectedInspectorPhoto.analysis?.sceneTags)}
                    />
                    <InspectorField
                      label="Theme Tags"
                      value={formatTagList(selectedInspectorPhoto.analysis?.themeTags)}
                    />
                  </InspectorSection>

                  <InspectorSection title="Heuristic Scene/Face Preview">
                    <InspectorField label="Debug-only Field" value="Live fallback preview is not persisted here" />
                    <InspectorField label="Heuristic Scene Tags" value={formatTagList(heuristicScenePreview?.sceneTags)} />
                    <InspectorField label="Heuristic Theme Tags" value={formatTagList(heuristicScenePreview?.themeTags)} />
                    <InspectorField
                      label="Heuristic Portrait-like"
                      value={heuristicScenePreview?.subjectCues?.portraitLike}
                    />
                    <InspectorField
                      label="Heuristic Group-photo-like"
                      value={heuristicScenePreview?.subjectCues?.groupPhotoLike}
                    />
                    <InspectorField label="Heuristic Face Count" value={heuristicFacePreview?.faces?.faceCount} />
                    <InspectorField label="Heuristic Has Face" value={heuristicFacePreview?.faces?.hasFace} />
                    <InspectorField
                      label="Heuristic Has Multiple Faces"
                      value={heuristicFacePreview?.faces?.hasMultipleFaces}
                    />
                  </InspectorSection>

                  <InspectorSection title="Native Image Labels">
                    <InspectorField
                      label="Persisted Fields"
                      value="analysis.nativeLabels, analysis.sceneTags, analysis.themeTags, analysis.safeExternalTags"
                    />
                    <InspectorField
                      label="Product Behavior"
                      value="Raw labels are inspector-first; broader behavior consumes only normalized app tags"
                    />
                    <InspectorField
                      label="Persisted Native Labels"
                      value={formatNativeLabels(selectedInspectorPhoto.analysis?.nativeLabels)}
                    />
                    <InspectorField
                      label="Persisted Normalized Tags"
                      value={formatTagList(selectedInspectorPhoto.analysis?.safeExternalTags)}
                    />
                  </InspectorSection>

                  <InspectorSection title="ML Kit Live Probe">
                    <InspectorField label="Debug-only Field" value="Native label probe result is not persisted" />
                    <InspectorField
                      label="Native Source"
                      value={nativeLabelProbeBusy ? "Checking..." : nativeLabelProbe?.source}
                    />
                    <InspectorField
                      label="Native Module Available"
                      value={nativeLabelProbeBusy ? "Checking..." : nativeLabelProbe?.available}
                    />
                    <InspectorField
                      label="Raw Native Labels"
                      value={formatNativeLabelProbe(nativeLabelProbe, nativeLabelProbeBusy)}
                    />
                    <InspectorField
                      label="Live Normalized Tags"
                      value={
                        nativeLabelProbe?.available
                          ? formatTagList(normalizeTagsFromNativeImageLabels(nativeLabelProbe.labels))
                          : "—"
                      }
                    />
                  </InspectorSection>

                  <InspectorSection title="Subject Cues">
                    <InspectorField
                      label="Portrait-like"
                      value={selectedInspectorPhoto.analysis?.subjectCues?.portraitLike}
                    />
                    <InspectorField
                      label="Group-photo-like"
                      value={selectedInspectorPhoto.analysis?.subjectCues?.groupPhotoLike}
                    />
                  </InspectorSection>

                  <InspectorSection title="Face Metadata">
                    <InspectorField
                      label="Persisted Source"
                      value={formatAnalysisSource(selectedInspectorPhoto.analysis?.sources?.faces)}
                    />
                    <InspectorField label="Face Count" value={selectedInspectorPhoto.analysis?.faces?.faceCount} />
                    <InspectorField label="Has Face" value={selectedInspectorPhoto.analysis?.faces?.hasFace} />
                    <InspectorField
                      label="Has Multiple Faces"
                      value={selectedInspectorPhoto.analysis?.faces?.hasMultipleFaces}
                    />
                  </InspectorSection>

                  <InspectorSection title="Native Face Detection">
                    <InspectorField
                      label="Persisted Fields"
                      value="analysis.nativeFaces, analysis.faces, analysis.subjectCues"
                    />
                    <InspectorField
                      label="Product Behavior"
                      value="No person recognition; raw face boxes stay local/debug-facing"
                    />
                    <InspectorField
                      label="Persisted Native Faces"
                      value={formatNativeFaces(selectedInspectorPhoto.analysis?.nativeFaces)}
                    />
                  </InspectorSection>

                  <InspectorSection title="ML Kit Face Live Probe">
                    <InspectorField label="Debug-only Field" value="Native face probe result is not persisted" />
                    <InspectorField
                      label="Native Source"
                      value={nativeFaceProbeBusy ? "Checking..." : nativeFaceProbe?.source}
                    />
                    <InspectorField
                      label="Native Module Available"
                      value={nativeFaceProbeBusy ? "Checking..." : nativeFaceProbe?.available}
                    />
                    <InspectorField
                      label="Raw Native Faces"
                      value={formatNativeFaceProbe(nativeFaceProbe, nativeFaceProbeBusy)}
                    />
                  </InspectorSection>

                  <InspectorSection title="Similarity">
                    <InspectorField
                      label="Duplicate Cluster ID"
                      value={selectedInspectorPhoto.analysis?.similarity?.duplicateClusterId}
                    />
                    <InspectorField
                      label="Similarity Cluster ID"
                      value={selectedInspectorPhoto.analysis?.similarity?.similarityClusterId}
                    />
                    <InspectorField
                      label="Representative Score"
                      value={selectedInspectorPhoto.analysis?.similarity?.representativeScore}
                    />
                  </InspectorSection>

                  <InspectorSection title="External and Local-Only">
                    <InspectorField
                      label="Safe External Tags"
                      value={selectedInspectorPhoto.analysis?.safeExternalTags?.join(", ")}
                    />
                    <InspectorField
                      label="Private Face Data Ref"
                      value={selectedInspectorPhoto.analysis?.localOnly?.privateFaceDataRef}
                    />
                    <InspectorField
                      label="Local Embedding Ref"
                      value={selectedInspectorPhoto.analysis?.localOnly?.localEmbeddingRef}
                    />
                  </InspectorSection>

                  <InspectorSection title="Copyable Debug Report">
                    <Text selectable style={styles.analysisCodeBlock}>
                      {inspectorDebugReport}
                    </Text>
                  </InspectorSection>

                  <InspectorSection title="Raw Analysis Snapshot">
                    <Text selectable style={styles.analysisCodeBlock}>
                      {JSON.stringify(selectedInspectorPhoto.analysis ?? {}, null, 2)}
                    </Text>
                  </InspectorSection>
                </>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable style={styles.deleteMemoryButton} onPress={closeAnalysisInspector} disabled={analysisInspectorBusy}>
                  <Text style={styles.deleteMemoryButtonText}>Close Inspector</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
