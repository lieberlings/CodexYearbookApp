import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { getRecentMediaLibraryPhotoChoicesWithProbe, MediaLibraryPhotoCatalogProbe, MediaLibraryPhotoChoice } from "../services/photoService";

type SelectionMode = "single" | "multiple";
const MEDIA_LIBRARY_PAGE_SIZE = 60;

type Props = {
  visible: boolean;
  title: string;
  subtitle: string;
  confirmLabel?: string;
  selectionMode?: SelectionMode;
  confirming?: boolean;
  showDiagnostics?: boolean;
  bottomInset?: number;
  onClose: () => void;
  onConfirm: (assetIds: string[]) => Promise<void> | void;
};

function formatValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function DiagnosticsField({ label, value }: { label: string; value: string | number | boolean | undefined }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text selectable style={styles.fieldValue}>
        {formatValue(value)}
      </Text>
    </View>
  );
}

export function MediaLibrarySelectionModal({
  visible,
  title,
  subtitle,
  confirmLabel = "Import Selected",
  selectionMode = "multiple",
  confirming = false,
  showDiagnostics = false,
  bottomInset = 0,
  onClose,
  onConfirm
}: Props) {
  const [choices, setChoices] = useState<MediaLibraryPhotoChoice[]>([]);
  const [choicesBusy, setChoicesBusy] = useState(false);
  const [choicesError, setChoicesError] = useState<string | undefined>(undefined);
  const [catalogProbe, setCatalogProbe] = useState<MediaLibraryPhotoCatalogProbe | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [thumbnailErrorIds, setThumbnailErrorIds] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedIds([]);
      setThumbnailErrorIds([]);
      setChoices([]);
      setNextCursor(undefined);
      setHasNextPage(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setChoicesBusy(true);
        setChoicesError(undefined);
        const { choices: nextChoices, probe } = await getRecentMediaLibraryPhotoChoicesWithProbe(MEDIA_LIBRARY_PAGE_SIZE);
        if (cancelled) {
          return;
        }
        setChoices(nextChoices);
        setCatalogProbe(probe);
        setNextCursor(probe.endCursor);
        setHasNextPage(Boolean(probe.hasNextPage));
        if (nextChoices.length === 0) {
          if (!probe.permissionGranted) {
            setChoicesError(
              probe.canAskAgain
                ? "Media Library permission is not granted yet, so no canonical photo assets can be queried."
                : "Media Library permission is blocked for this app, so the asset query cannot return photos."
            );
          } else if (probe.error) {
            setChoicesError(probe.error);
          } else {
            setChoicesError(
              "The Media Library query completed but returned zero photo assets. The app still cannot see the device photo catalog through this Android permission path."
            );
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Unable to load recent Media Library photo assets.";
        setChoices([]);
        setChoicesError(message);
        setCatalogProbe({
          permissionStatus: "error",
          permissionGranted: false,
          canAskAgain: false,
          requestAttempted: false,
          requestGranted: false,
          queryAttempted: false,
          returnedCount: 0,
          error: message
        });
      } finally {
        if (!cancelled) {
          setChoicesBusy(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const loadMore = useCallback(async () => {
    if (choicesBusy || confirming || !hasNextPage) {
      return;
    }

    try {
      setChoicesBusy(true);
      setChoicesError(undefined);
      const { choices: nextChoices, probe } = await getRecentMediaLibraryPhotoChoicesWithProbe(
        MEDIA_LIBRARY_PAGE_SIZE,
        nextCursor
      );
      setCatalogProbe(probe);
      setNextCursor(probe.endCursor);
      setHasNextPage(Boolean(probe.hasNextPage));
      setChoices((prev) => {
        const seen = new Set(prev.map((choice) => choice.id));
        return [...prev, ...nextChoices.filter((choice) => !seen.has(choice.id))];
      });
    } catch (error) {
      setChoicesError(error instanceof Error ? error.message : "Unable to load more Media Library photo assets.");
    } finally {
      setChoicesBusy(false);
    }
  }, [choicesBusy, confirming, hasNextPage, nextCursor]);

  const toggleSelection = useCallback(
    async (assetId: string) => {
      if (confirming) {
        return;
      }
      if (selectionMode === "single") {
        await onConfirm([assetId]);
        return;
      }
      setSelectedIds((prev) => (prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]));
    },
    [confirming, onConfirm, selectionMode]
  );

  const submitSelection = useCallback(async () => {
    if (selectionMode !== "multiple" || selectedIds.length === 0 || confirming) {
      return;
    }
    await onConfirm(selectedIds);
  }, [confirming, onConfirm, selectedIds, selectionMode]);

  const markThumbnailError = useCallback((assetId: string) => {
    setThumbnailErrorIds((prev) => (prev.includes(assetId) ? prev : [...prev, assetId]));
  }, []);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.avoider}>
          <View style={[styles.sheet, { paddingBottom: bottomInset + 18 }]}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} disabled={confirming}>
                <Ionicons name="close" size={22} color="#eef4ff" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {showDiagnostics && catalogProbe ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Probe Diagnostics</Text>
                  <View style={styles.sectionBody}>
                    <DiagnosticsField label="Permission Status" value={catalogProbe.permissionStatus} />
                    <DiagnosticsField label="Permission Granted" value={catalogProbe.permissionGranted} />
                    <DiagnosticsField label="Can Ask Again" value={catalogProbe.canAskAgain} />
                    <DiagnosticsField label="Permission Request Attempted" value={catalogProbe.requestAttempted} />
                    <DiagnosticsField label="Permission Request Granted" value={catalogProbe.requestGranted} />
                    <DiagnosticsField label="Query Attempted" value={catalogProbe.queryAttempted} />
                    <DiagnosticsField label="Assets Returned" value={catalogProbe.returnedCount} />
                    <DiagnosticsField label="Total Asset Count" value={catalogProbe.totalCount} />
                    <DiagnosticsField label="Query Error" value={catalogProbe.error} />
                  </View>
                </View>
              ) : null}

              {choicesBusy && choices.length === 0 ? (
                <View style={styles.emptyCard}>
                  <ActivityIndicator color="#7fa7ff" />
                  <Text style={styles.emptyTitle}>Loading Media Library assets</Text>
                  <Text style={styles.emptyText}>Fetching recent photo assets for canonical project and memory imports.</Text>
                </View>
              ) : choices.length > 0 ? (
                <>
                  <View style={styles.grid}>
                    {choices.map((asset) => {
                      const selected = selectedIds.includes(asset.id);
                      const thumbnailFailed = thumbnailErrorIds.includes(asset.id);
                      return (
                        <Pressable
                          key={asset.id}
                          style={[styles.gridItem, selected ? styles.gridItemSelected : null]}
                          onPress={() => void toggleSelection(asset.id)}
                          disabled={confirming}
                        >
                          {thumbnailFailed ? (
                            <View style={styles.thumbnailFallback}>
                              <Ionicons name="image-outline" size={30} color="#6d82aa" />
                              <Text numberOfLines={2} style={styles.thumbnailFallbackText}>
                                Preview unavailable
                              </Text>
                            </View>
                          ) : (
                            <Image
                              source={{ uri: asset.uri }}
                              style={styles.gridImage}
                              resizeMode="cover"
                              onError={() => markThumbnailError(asset.id)}
                            />
                          )}
                          <View style={[styles.badge, selected ? styles.badgeSelected : null]}>
                            {confirming && (selectionMode === "single" || selected) ? (
                              <ActivityIndicator color="#ffffff" size="small" />
                            ) : (
                              <Text style={[styles.badgeText, selected ? styles.badgeTextSelected : null]}>
                                {selectionMode === "single" ? "Import" : selected ? "Selected" : "Select"}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.catalogFooter}>
                    <Text style={styles.catalogFooterText}>
                      Showing {choices.length}
                      {catalogProbe?.totalCount ? ` of ${catalogProbe.totalCount}` : ""} Media Library photos.
                      {thumbnailErrorIds.length > 0
                        ? ` ${thumbnailErrorIds.length} preview thumbnail${thumbnailErrorIds.length === 1 ? "" : "s"} failed but can still be selected.`
                        : ""}
                    </Text>
                    {hasNextPage ? (
                      <Pressable
                        style={[styles.loadMoreButton, choicesBusy || confirming ? styles.primaryButtonDisabled : null]}
                        onPress={() => void loadMore()}
                        disabled={choicesBusy || confirming}
                      >
                        {choicesBusy ? (
                          <ActivityIndicator color="#eef4ff" />
                        ) : (
                          <Text style={styles.loadMoreButtonText}>Load More</Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="albums-outline" size={30} color="#5d7097" />
                  <Text style={styles.emptyTitle}>No Media Library assets ready</Text>
                  <Text style={styles.emptyText}>
                    {choicesError ??
                      "No recent photo assets were returned. This can happen if permission is blocked or the library query returned nothing."}
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                {selectionMode === "multiple" ? (
                  <Pressable
                    style={[
                      styles.primaryButton,
                      selectedIds.length === 0 || confirming ? styles.primaryButtonDisabled : null
                    ]}
                    onPress={() => void submitSelection()}
                    disabled={selectedIds.length === 0 || confirming}
                  >
                    {confirming ? <ActivityIndicator color="#eef4ff" /> : <Text style={styles.primaryButtonText}>{confirmLabel}</Text>}
                  </Pressable>
                ) : null}
                <Pressable style={styles.secondaryButton} onPress={onClose} disabled={confirming}>
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(6, 10, 18, 0.86)",
    justifyContent: "flex-end"
  },
  avoider: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#20304d",
    backgroundColor: "#0d1526",
    paddingHorizontal: 18,
    paddingTop: 18
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18
  },
  headerText: {
    flex: 1,
    gap: 8
  },
  title: {
    color: "#f8fbff",
    fontSize: 20,
    fontWeight: "800"
  },
  subtitle: {
    color: "#90a4cc",
    fontSize: 13,
    lineHeight: 20
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#15213a"
  },
  content: {
    gap: 16,
    paddingBottom: 12
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    color: "#dfe8fb",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  sectionBody: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#20304d",
    backgroundColor: "#101a2d",
    overflow: "hidden"
  },
  fieldRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#223456",
    gap: 6
  },
  fieldLabel: {
    color: "#88a0cb",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  fieldValue: {
    color: "#eef4ff",
    fontSize: 14,
    lineHeight: 20
  },
  emptyCard: {
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#304465",
    backgroundColor: "#111a2c",
    alignItems: "center",
    gap: 12
  },
  emptyTitle: {
    color: "#eef4ff",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  emptyText: {
    color: "#8ea3ca",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  gridItem: {
    width: "47%",
    aspectRatio: 0.76,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#24385f",
    backgroundColor: "#14223a"
  },
  gridItemSelected: {
    borderColor: "#2f80ff",
    borderWidth: 2
  },
  gridImage: {
    width: "100%",
    height: "100%"
  },
  thumbnailFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: "#101a2d"
  },
  thumbnailFallbackText: {
    color: "#9eb0d3",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  badge: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "rgba(31, 78, 158, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  badgeSelected: {
    backgroundColor: "rgba(28, 129, 84, 0.95)"
  },
  badgeText: {
    color: "#eef4ff",
    fontSize: 13,
    fontWeight: "800"
  },
  badgeTextSelected: {
    color: "#ffffff"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  catalogFooter: {
    gap: 10,
    alignItems: "center"
  },
  catalogFooterText: {
    color: "#8ea3ca",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  loadMoreButton: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#172a48",
    borderWidth: 1,
    borderColor: "#2d4f82",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  loadMoreButtonText: {
    color: "#eef4ff",
    fontSize: 13,
    fontWeight: "800"
  },
  primaryButton: {
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#2f80ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: "#eef4ff",
    fontSize: 14,
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#23121a",
    borderWidth: 1,
    borderColor: "#703043"
  },
  secondaryButtonText: {
    color: "#ffb8c3",
    fontSize: 14,
    fontWeight: "800"
  }
});
