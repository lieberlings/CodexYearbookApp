import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CoverPanelPreview, CoverSpread, SpinePreview } from "../../../src/components/CoverSpread";
import { PageBackground } from "../../../src/components/PageBackground";
import { useProjectBook } from "../../../src/components/useProjectBook";
import { useAppData } from "../../../src/context/AppContext";
import { backgroundPacks } from "../../../src/library/backgrounds";
import { getBackgroundAssetSelection } from "../../../src/layout/backgroundAssets";
import { coverGeometry } from "../../../src/layout/bookSpreads";
import { useEditorStore } from "../../../src/state/editorStore";
import { ColorPicker } from "../../../src/ui/ColorPicker";
import type { CoverDesign, CoverPanel } from "../../../src/types";


export default function CoverDesignScreen() {
  const { id, panel: requestedPanel } = useLocalSearchParams<{ id: string; panel?: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const book = useProjectBook(projectId ?? "");
  const { project } = book;
  const { updateProject, createMemory, pickProjectThumbnail } = useAppData();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<CoverPanel>("front");
  useEffect(() => { if (requestedPanel === "front" || requestedPanel === "back" || requestedPanel === "spine") setSelected(requestedPanel); }, [requestedPanel]);
  const [guides, setGuides] = useState(false);
  const [patterns, setPatterns] = useState(false);
  const [packId, setPackId] = useState(backgroundPacks[0].id);
  const [busy, setBusy] = useState(false);
  const opening = useRef(false);
  const undo = useRef<CoverDesign[]>([]);
  const redo = useRef<CoverDesign[]>([]);
  const [, refresh] = useState(0);
  const currentDesign = useRef(project?.coverDesign ?? {});
  currentDesign.current = project?.coverDesign ?? {};
  const pageWidth = Math.min(width - insets.left - insets.right - 40, 540);

  function change(patch: Partial<CoverDesign>) {
    if (!project) return;
    undo.current = [...undo.current.slice(-49), currentDesign.current];
    redo.current = [];
    currentDesign.current = { ...currentDesign.current, ...patch };
    updateProject(project.id, { coverDesign: currentDesign.current });
    refresh(n => n + 1);
  }
  function history(backwards: boolean) {
    if (!project) return;
    const from = backwards ? undo.current : redo.current;
    const to = backwards ? redo.current : undo.current;
    const design = from.pop();
    if (!design) return;
    to.push(currentDesign.current);
    currentDesign.current = design;
    updateProject(project.id, { coverDesign: design });
    refresh(n => n + 1);
  }
  async function editPanel(panel: "front" | "back" | "dedication") {
    if (!project || opening.current) return;
    opening.current = true;
    setBusy(true);
    try {
      const role = panel === "dedication" ? "dedication" : panel === "front" ? "front-cover" : "back-cover";
      const existing = book.memories.find(memory => memory.bookRole === role);
      const memoryId = existing?.id ?? await createMemory(project.id, panel === "dedication" ? "Dedication" : `${panel === "front" ? "Front" : "Back"} cover`, { bookRole: role });
      const firstPage = existing ? book.sections[existing.id]?.[0] : undefined;
      useEditorStore.getState().setSelection(firstPage?.id, undefined);
      router.push({ pathname: "/memory/[id]", params: { id: memoryId } });
    } catch (error) { Alert.alert("Unable to open cover", (error as Error).message); }
    finally { opening.current = false; setBusy(false); }
  }
  async function pickBackgroundPhoto() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    try {
      const uri = await pickProjectThumbnail();
      if (uri) change({ background: { kind: "photo", color: "#FBF6EE", photoUri: uri } });
    } catch (error) { Alert.alert("Unable to pick background", (error as Error).message); }
    finally { opening.current = false; setBusy(false); }
  }
  if (!project) return <View style={styles.screen}><Text>Project not found.</Text></View>;
  const design = project.coverDesign;
  const geometry = coverGeometry(design);
  const selectedPage = selected === "front" ? book.front : book.back;
  const pack = backgroundPacks.find(item => item.id === packId)!;
  const themeColors = getBackgroundAssetSelection(design?.background?.assetId)?.asset.palette ?? [];
  const extraCoverPages = [book.front, book.back].some(page => page && page.pageCount > 1);
  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back to project" style={styles.icon} onPress={() => router.back()}><Ionicons name="chevron-back" size={27} color="#241F1B" /></Pressable>
      <View style={{ flex: 1 }}><Text style={styles.title}>Design cover</Text><Text numberOfLines={1} style={styles.hint}>{project.name}</Text></View>
      <Pressable accessibilityLabel="Undo cover setting" disabled={!undo.current.length} style={[styles.icon, !undo.current.length && styles.disabled]} onPress={() => history(true)}><Ionicons name="arrow-undo" size={21} color="#6B5BD2" /></Pressable>
      <Pressable accessibilityLabel="Redo cover setting" disabled={!redo.current.length} style={[styles.icon, !redo.current.length && styles.disabled]} onPress={() => history(false)}><Ionicons name="arrow-redo" size={21} color="#6B5BD2" /></Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.paper}><CoverSpread {...book} project={project} width={pageWidth} selected={selected} onSelect={setSelected} guides={guides} /></View>
      <View style={[styles.row, { width: pageWidth }]}>{(["back", "spine", "front"] as const).map(panel => <Pressable key={panel} accessibilityRole="button" accessibilityState={{ selected: selected === panel }} style={[styles.tab, selected === panel && styles.activeTab]} onPress={() => setSelected(panel)}><Text style={selected === panel ? styles.activeText : styles.body}>{panel === "spine" ? "Spine" : `${panel === "front" ? "Front" : "Back"} cover`}</Text></Pressable>)}</View>
      <Text style={styles.hint}>{geometry.confirmed ? "Outside cover · Back – Spine – Front" : "Cover layout preview · Spine width awaits print settings"}</Text>
      <View style={[styles.row, { width: pageWidth }]}><Text style={[styles.body, { flex: 1 }]}>Design guides</Text><Switch accessibilityLabel="Show design guides" value={guides} onValueChange={setGuides} trackColor={{ true: "#6B5BD2" }} /></View>
      {guides && <Text style={styles.hint}>Dashed lines are composition guides, not the printer’s trim or bleed boundaries.</Text>}
      {extraCoverPages && <Text style={styles.hint}>Your existing cover sections have extra pages. They are preserved in the editor; the first page of each is shown on this cover.</Text>}

      <View style={[styles.card, { width: pageWidth }]}>
        <Text style={styles.heading}>{selected === "spine" ? "Spine" : `${selected === "front" ? "Front" : "Back"} cover`}</Text>
        {selected !== "spine" ? <>
          <View style={{ alignSelf: "center" }}><CoverPanelPreview project={project} panel={selected} page={selectedPage} photosById={book.photosById} size={Math.min(pageWidth - 32, 300)} /></View>
          <Pressable style={styles.primary} disabled={busy} onPress={() => void editPanel(selected)}>{busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Edit layout, photos & text</Text>}</Pressable>
          {design?.background && <View style={styles.row}><Text style={[styles.body, { flex: 1 }]}>Use a separate background here</Text><Switch accessibilityLabel={`Use separate ${selected} background`} value={Boolean(design.panelBackgrounds?.[selected])} onValueChange={value => change({ panelBackgrounds: { ...design.panelBackgrounds, [selected]: value } })} /></View>}
        </> : <>
          <View style={{ alignSelf: "center" }}><SpinePreview project={project} height={200} width={36} /></View>
          <Text style={styles.label}>Title</Text><TextInput accessibilityLabel="Spine title" style={styles.input} value={design?.spineTitle ?? project.name} onChangeText={spineTitle => change({ spineTitle })} placeholder="Book title" />
          <Pressable onPress={() => change({ spineTitle: undefined })}><Text style={styles.link}>Use project name</Text></Pressable>
          <Text style={styles.label}>Author / year (optional)</Text><TextInput accessibilityLabel="Spine author or year" style={styles.input} value={design?.spineSubtitle ?? ""} onChangeText={spineSubtitle => change({ spineSubtitle })} placeholder="e.g. Our family · 2026" />
          <View style={styles.row}>{(["down", "up"] as const).map(direction => <Pressable key={direction} style={[styles.tab, (design?.spineDirection ?? "down") === direction && styles.activeTab]} onPress={() => change({ spineDirection: direction })}><Text style={styles.body}>{direction === "down" ? "Top to bottom" : "Bottom to top"}</Text></Pressable>)}</View>
          <ColorPicker label="Text color" value={design?.spineTextColor} themeColors={themeColors} themeLabel="Cover theme" onChange={spineTextColor => change({ spineTextColor })} />
          <ColorPicker label="Spine background" value={design?.spineColor} themeColors={themeColors} themeLabel="Cover theme" onChange={spineColor => change({ spineColor })} />
          <Pressable onPress={() => change({ spineColor: undefined })}><Text style={styles.link}>Match shared background</Text></Pressable>
        </>}
      </View>

      <View style={[styles.card, { width: pageWidth }]}>
        <Text style={styles.heading}>Shared cover background</Text><Text style={styles.hint}>One background flows across the back, spine and front. Panel layouts stay in place.</Text>
        <View style={styles.row}><Pressable style={styles.secondary} disabled={busy} onPress={() => void pickBackgroundPhoto()}><Text style={styles.link}>Choose photo</Text></Pressable><Pressable style={styles.secondary} onPress={() => setPatterns(value => !value)}><Text style={styles.link}>{patterns ? "Hide patterns" : "Library patterns"}</Text></Pressable></View>
        <ColorPicker label="Background color" value={design?.background?.kind === "color" ? design.background.color : undefined} themeColors={themeColors} themeLabel="Cover theme" onChange={color => change({ background: { kind: "color", color } })} />
        {patterns && <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{backgroundPacks.map(item => <Pressable key={item.id} style={[styles.pack, item.id === packId && styles.activeTab]} onPress={() => setPackId(item.id)}><Text style={styles.body}>{item.label}</Text></Pressable>)}</ScrollView>
          <View style={styles.swatches}>{pack.backgrounds.map(asset => <Pressable key={asset.id} accessibilityLabel={`${pack.label} background ${asset.number}`} style={[styles.pattern, design?.background?.assetId === asset.id && styles.selectedSwatch]} onPress={() => change({ background: { kind: "library", color: asset.backgroundColor, assetId: asset.id } })}><PageBackground backgroundAssetId={asset.id} backgroundColor={asset.backgroundColor} /><Text style={styles.number}>{asset.number}</Text></Pressable>)}</View>
        </>}
        {design?.background && <Pressable onPress={() => change({ background: undefined })}><Text style={styles.link}>Remove shared background</Text></Pressable>}
      </View>
      <Pressable style={[styles.secondary, { width: pageWidth }]} disabled={busy} onPress={() => void editPanel("dedication")}><Text style={styles.link}>{book.memories.some(memory => memory.bookRole === "dedication") ? "Edit dedication page" : "Add dedication page"}</Text></Pressable>
      <Pressable style={[styles.primary, { width: pageWidth }]} onPress={() => router.push({ pathname: "/project/[id]/preview", params: { id: project.id } })}><Text style={styles.primaryText}>Preview book</Text></Pressable>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FBF6EE" }, header: { flexDirection: "row", alignItems: "center", padding: 12 }, icon: { padding: 10 }, title: { color: "#241F1B", fontSize: 21, fontWeight: "700" },
  content: { alignItems: "center", paddingVertical: 16, gap: 14, paddingBottom: 36 }, paper: { elevation: 3, shadowOpacity: .15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12, alignItems: "center", backgroundColor: "#EFE7DB" }, activeTab: { backgroundColor: "#E3DDF8" }, activeText: { color: "#5142B4", fontWeight: "700" },
  body: { color: "#4A4239", fontSize: 13 }, hint: { color: "#796E61", fontSize: 12, lineHeight: 18, paddingHorizontal: 4 }, card: { padding: 16, gap: 14, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E5DACD" }, heading: { fontSize: 17, fontWeight: "700", color: "#241F1B" }, label: { fontSize: 13, fontWeight: "600", color: "#4A4239" },
  input: { borderWidth: 1, borderColor: "#D8CFC2", borderRadius: 10, padding: 12, color: "#241F1B" }, primary: { backgroundColor: "#6B5BD2", borderRadius: 12, padding: 14, alignItems: "center" }, primaryText: { color: "white", fontWeight: "700" }, secondary: { padding: 12, borderRadius: 12, backgroundColor: "#EFE7DB", alignItems: "center" }, link: { color: "#6B5BD2", fontWeight: "600", fontSize: 13 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, selectedSwatch: { borderWidth: 3, borderColor: "#6B5BD2" }, pack: { padding: 10, borderRadius: 10, marginRight: 6 }, pattern: { width: 64, height: 64, overflow: "hidden", borderRadius: 10, borderWidth: 1, borderColor: "#D8CFC2" }, number: { position: "absolute", bottom: 2, left: 3, backgroundColor: "#FFFFFFDD", borderRadius: 6, paddingHorizontal: 5, fontSize: 11 }, disabled: { opacity: .3 }
});
