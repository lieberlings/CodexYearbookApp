import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { BookPageCanvas } from "../../../src/components/BookPageCanvas";
import { CoverPanelPreview } from "../../../src/components/CoverSpread";
import { useProjectBook } from "../../../src/components/useProjectBook";
import { BookSpread, buildBookSpreads, spreadLabel } from "../../../src/layout/bookSpreads";

export default function ProjectPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const book = useProjectBook(projectId ?? "");
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [showAll, setShowAll] = useState(false);
  const [index, setIndex] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const spreads = useMemo(() => buildBookSpreads(book.pages, book.memories), [book.pages, book.memories]);
  const current = Math.min(index, spreads.length - 1);
  const availableWidth = width - insets.left - insets.right - 40;
  const availableHeight = height - insets.top - insets.bottom - 156;
  const pageSize = Math.max(40, Math.min(availableWidth / 2, availableHeight, 500));
  const gridWidth = Math.min(availableWidth, 1000);
  const gridColumns = gridWidth > 600 ? 2 : 1;
  const thumbSize = Math.min(160, (gridWidth / gridColumns - 24) / 2);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !showAll && Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 45) return;
      setIndex(value => Math.max(0, Math.min(spreads.length - 1, value + (gesture.dx < 0 ? 1 : -1))));
    }
  }), [showAll, spreads.length]);

  function renderSpread(spread: BookSpread, size: number) {
    if (!book.project) return null;
    if (spread.kind !== "content") return <View style={styles.closedBook}>
      <CoverPanelPreview project={book.project} panel={spread.kind} page={spread.kind === "front" ? spread.right : spread.left} photosById={book.photosById} size={size} />
      <View pointerEvents="none" style={[styles.coverHinge, spread.kind === "back" ? { right: 4 } : { left: 4 }]} />
    </View>;
    return <View style={{ width: size * 2 }}>
      <View style={[styles.openBook, { width: size * 2, height: size }]}>
        {(["left", "right"] as const).map(side => <View key={side} style={{ width: size, height: size, backgroundColor: "#FCFAF4" }}>
          {spread[side] && <BookPageCanvas page={spread[side]} photosById={book.photosById} size={size} />}
        </View>)}
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={size * 2} height={size}>
          <Defs><LinearGradient id={`gutter-${spread.id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#241F1B" stopOpacity="0" /><Stop offset=".46" stopColor="#241F1B" stopOpacity=".08" />
            <Stop offset=".5" stopColor="#241F1B" stopOpacity=".3" /><Stop offset=".54" stopColor="#241F1B" stopOpacity=".13" /><Stop offset="1" stopColor="#241F1B" stopOpacity="0" />
          </LinearGradient></Defs><Rect x={size - size * .07} y="0" width={size * .14} height={size} fill={`url(#gutter-${spread.id})`} />
        </Svg>
        <View pointerEvents="none" style={styles.pageEdges} />
      </View>
      <View style={styles.numbers}><Text style={styles.pageNumber}>{spread.leftNumber ?? "Inside cover"}</Text><Text style={styles.pageNumber}>{spread.rightNumber ?? "Blank"}</Text></View>
    </View>;
  }

  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <Stack.Screen options={{ headerShown: false, orientation: landscape ? "landscape" : "all" }} />
    <StatusBar style="light" />
    <View style={styles.topBar}>
      <Pressable accessibilityLabel="Close preview" style={styles.icon} onPress={() => router.back()}><Ionicons name="close" size={24} color="#FBF6EE" /></Pressable>
      <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.title}>{book.project?.name ?? "Project not found"}</Text><Text style={styles.subtitle}>Book preview · {book.pages.filter(page => !book.memories.some(memory => memory.id === page.memoryId && (memory.bookRole === "front-cover" || memory.bookRole === "back-cover"))).length} interior pages</Text></View>
      <Pressable accessibilityLabel={landscape ? "Use device rotation" : "Rotate preview to landscape"} accessibilityState={{ selected: landscape }} style={[styles.icon, landscape && styles.active]} onPress={() => setLandscape(value => !value)}><Ionicons name="phone-landscape-outline" size={23} color="#FBF6EE" /></Pressable>
      <Pressable accessibilityLabel={showAll ? "Show open book" : "Show all spreads"} accessibilityState={{ selected: showAll }} style={[styles.icon, showAll && styles.active]} onPress={() => setShowAll(value => !value)}><Ionicons name={showAll ? "book-outline" : "grid-outline"} size={22} color="#FBF6EE" /></Pressable>
    </View>
    {!book.project ? <View style={styles.stage}><Text style={styles.subtitle}>Project not found.</Text></View> : showAll ? <ScrollView contentContainerStyle={styles.gridScroll}>
      <View style={[styles.grid, { width: gridWidth }]}>{spreads.map((spread, spreadIndex) => <Pressable key={spread.id} accessibilityRole="button" accessibilityLabel={`Open ${spreadLabel(spread)}`} onPress={() => { setIndex(spreadIndex); setShowAll(false); }} style={[styles.thumbnail, { width: gridWidth / gridColumns - 12 }]}>
        {renderSpread(spread, thumbSize)}<Text style={styles.label}>{spreadLabel(spread)}</Text>
      </Pressable>)}</View>
    </ScrollView> : <View style={styles.stage} {...pan.panHandlers}>
      {renderSpread(spreads[current], pageSize)}
      {book.pages.length === 0 && <Text style={styles.empty}>Add memories and design your cover to fill this book.</Text>}
    </View>}
    {!showAll && <View style={styles.navigation}>
      <Pressable accessibilityLabel="Previous spread" disabled={current === 0} style={[styles.icon, current === 0 && styles.disabled]} onPress={() => setIndex(Math.max(0, current - 1))}><Ionicons name="chevron-back" size={26} color="#FBF6EE" /></Pressable>
      <View style={{ alignItems: "center" }}><Text style={styles.label}>{spreadLabel(spreads[current])}</Text><Text style={styles.subtitle}>Swipe to turn pages</Text></View>
      <Pressable accessibilityLabel="Next spread" disabled={current === spreads.length - 1} style={[styles.icon, current === spreads.length - 1 && styles.disabled]} onPress={() => setIndex(Math.min(spreads.length - 1, current + 1))}><Ionicons name="chevron-forward" size={26} color="#FBF6EE" /></Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#241F1B" }, topBar: { flexDirection: "row", alignItems: "center", padding: 10, gap: 8 },
  icon: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 12 }, active: { backgroundColor: "#514436" }, disabled: { opacity: .3 },
  title: { color: "#FBF6EE", fontWeight: "700", fontSize: 17 }, subtitle: { color: "#C5B8A7", fontSize: 11, marginTop: 3 }, label: { color: "#FBF6EE", fontSize: 14, fontWeight: "600", marginTop: 8 },
  stage: { flex: 1, justifyContent: "center", alignItems: "center", padding: 12 }, navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 8 },
  openBook: { flexDirection: "row", backgroundColor: "#FCFAF4", shadowColor: "#000", shadowOpacity: .5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  closedBook: { borderRadius: 3, overflow: "hidden", borderWidth: 2, borderColor: "#D9CDBD", elevation: 8, shadowColor: "#000", shadowOpacity: .4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  coverHinge: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "#00000016" },
  pageEdges: { position: "absolute", left: 1, right: 1, bottom: -3, height: 3, borderBottomWidth: 1, borderTopWidth: 1, borderColor: "#C8BFB2", backgroundColor: "#E9E2D7" },
  numbers: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 }, pageNumber: { color: "#C5B8A7", fontSize: 11 },
  gridScroll: { alignItems: "center", paddingVertical: 18 }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }, thumbnail: { alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 12, backgroundColor: "#332C25", gap: 8 }, empty: { color: "#C5B8A7", marginTop: 16, maxWidth: 280, textAlign: "center" }
});
