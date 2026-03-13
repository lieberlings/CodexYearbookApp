import { Animated, Image, StyleSheet, Text, View, ViewStyle } from "react-native";
import { DragSession } from "./types";

export function DragOverlay({
  session,
  style
}: {
  session: DragSession;
  style: Animated.WithAnimatedValue<ViewStyle>;
}) {
  if (!session.payload) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, style, {
      width: session.payload.sourceRect.width,
      height: session.payload.sourceRect.height
    }]}>
      {session.payload.previewData.kind === "photo" ? (
        <Image source={{ uri: session.payload.previewData.uri }} style={styles.photo} />
      ) : (
        <View style={[styles.pageCard, { backgroundColor: session.payload.previewData.backgroundColor ?? "#ffffff" }]}>
          {session.payload.previewData.blocks.map((block, index) => (
            <View
              key={`${session.payload?.itemId}-${index}`}
              style={[
                styles.pageBlock,
                {
                  left: `${block.x * 100}%`,
                  top: `${block.y * 100}%`,
                  width: `${block.width * 100}%`,
                  height: `${block.height * 100}%`
                }
              ]}
            />
          ))}
          <Text style={styles.pageLabel}>{session.payload.previewData.label}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    zIndex: 1000,
    elevation: 24,
    borderRadius: 16,
    shadowColor: "#020617",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    overflow: "hidden"
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: 16
  },
  pageCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    overflow: "hidden",
    padding: 8
  },
  pageBlock: {
    position: "absolute",
    backgroundColor: "#cbd5e1",
    borderRadius: 4
  },
  pageLabel: {
    position: "absolute",
    left: 8,
    bottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a"
  }
});
