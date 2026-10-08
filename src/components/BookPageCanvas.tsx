import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getShapeTextLayout } from "../layout/shapeText";
import { getPhotoAspect, getPhotoRenderMetrics } from "../layout/photoMetrics";
import type { LayoutPage } from "../layout/schemas";
import type { PhotoItem } from "../types";
import { ObjectShape } from "./ObjectShape";
import { PageBackground } from "./PageBackground";

function applyColorOpacity(color: string | undefined, opacity: number | undefined): string {
  if (!color) {
    return "transparent";
  }
  const normalizedOpacity = Math.max(0, Math.min(1, opacity ?? 1));
  const hex = color.replace("#", "");
  const safeHex = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
}

export function BookPageCanvas({ page, photosById, size, background }: {
  page: LayoutPage; photosById: Record<string, PhotoItem>; size: number; background?: ReactNode;
}) {
  const pageInnerWidth = size;
  const pageContentHeight = size;
  const previewScale = size / 320;
  const textAnchorSlotIds = new Set(page.textBoxes.map(box => box.anchorSlotId).filter(Boolean));
  return <View pointerEvents="none" style={{ width: size, height: size, overflow: "hidden", backgroundColor: "white" }}>
              {background ?? <PageBackground backgroundAssetId={page.backgroundAssetId} backgroundColor={page.backgroundColor} />}
              {page.slots.map((slot) => {
                const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                if (!photo && textAnchorSlotIds.has(slot.id)) {
                  return null;
                }
                const photoMetrics = getPhotoRenderMetrics({
                  containerAspect: slot.frame.width / Math.max(0.0001, slot.frame.height),
                  imageAspect: getPhotoAspect(photo),
                  fitMode: slot.fitMode,
                  scale: slot.photoScale ?? 1,
                  offsetX: slot.photoOffsetX ?? 0,
                  offsetY: slot.photoOffsetY ?? 0
                });
                return (
                  <View
                    key={slot.id}
                    style={[
                      styles.slotFrame,
                      {
                        left: `${slot.frame.x * 100}%`,
                        top: `${slot.frame.y * 100}%`,
                        width: `${slot.frame.width * 100}%`,
                        height: `${slot.frame.height * 100}%`,
                        transform: [{ rotate: `${slot.rotation ?? 0}deg` }], zIndex: slot.zIndex ?? 2,
                        backgroundColor: slot.shape && slot.shape !== "rectangle" ? "transparent" : "#f8fafc",
                        borderColor: page.slotBorderColor ?? "#e2e8f0",
                        borderWidth: slot.shape && slot.shape !== "rectangle" ? 0 : (page.slotBorderWidth ?? 1) * previewScale,
                        borderRadius: (page.slotCornerRadius ?? 0) * previewScale
                      }
                    ]}
                  >
                    {slot.shape && slot.shape !== "rectangle" ? <ObjectShape shape={slot.shape} uri={photo?.uri} metrics={photoMetrics} border={page.slotBorderColor} borderWidth={page.slotBorderWidth} /> : photo ? (
                      <Image
                        source={{ uri: photo.uri }}
                        style={[
                          styles.slotImage,
                          {
                            width: `${photoMetrics.width * 100}%`,
                            height: `${photoMetrics.height * 100}%`,
                            left: `${photoMetrics.leftPercent}%`,
                            top: `${photoMetrics.topPercent}%`
                          }
                        ]}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                );
              })}
              {page.textBoxes.map((textBox) => {
                const anchorSlot = textBox.anchorSlotId
                  ? page.slots.find((slot) => slot.id === textBox.anchorSlotId)
                  : undefined;
                const textFrame = anchorSlot?.frame ?? textBox;
                const shapeText = getShapeTextLayout(textBox.shape, textBox.text, textFrame.width * pageInnerWidth, textFrame.height * pageContentHeight, textBox.sticker ? textFrame.height * pageContentHeight * .7 : (textBox.fontSize ?? page.textSize ?? 24) * previewScale, textBox.borderWidth);
                return (
                  <View
                    key={textBox.id}
                    style={[
                      styles.textBox,
                      {
                        left: `${textFrame.x * 100}%`,
                        top: `${textFrame.y * 100}%`,
                        width: `${textFrame.width * 100}%`,
                        height: `${textFrame.height * 100}%`,
                        transform: [{ rotate: `${textBox.rotation ?? 0}deg` }], zIndex: textBox.zIndex ?? 20,
                        borderWidth: textBox.shape && textBox.shape !== "rectangle" ? 0 : (textBox.borderWidth ?? 0) * previewScale,
                        paddingHorizontal: textBox.shape && textBox.shape !== "rectangle" ? 0 : textBox.sticker ? 0 : 10 * previewScale,
                        paddingVertical: shapeText ? 0 : 6 * previewScale,
                        borderColor: textBox.borderColor ?? "#0f172a",
                        borderRadius: (textBox.cornerRadius ?? 0) * previewScale,
                        backgroundColor: (anchorSlot || (textBox.shape && textBox.shape !== "rectangle"))
                          ? "transparent"
                          : applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0)
                      }
                    ]}
                  >
                    {textBox.shape && textBox.shape !== "rectangle" && <ObjectShape shape={textBox.shape} fill={applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0)} border={textBox.borderColor} borderWidth={textBox.borderWidth} />}
                    <View style={shapeText ? { position: "absolute", left: shapeText.left, top: shapeText.top, width: shapeText.width, height: shapeText.height, overflow: "hidden", justifyContent: "center" } : { flex: 1, justifyContent: "center" }}>
                    <Text adjustsFontSizeToFit={Boolean(shapeText)} numberOfLines={shapeText?.numberOfLines} minimumFontScale={0.01}
                      style={[
                        styles.textBoxText,
                        {
                          color: textBox.textColor ?? page.textColor ?? "#0f172a",
                          fontSize: shapeText?.fontSize ?? (textBox.sticker ? textFrame.height * pageContentHeight * .7 : (textBox.fontSize ?? page.textSize ?? 24) * previewScale),
                          lineHeight: shapeText?.lineHeight ?? (textBox.sticker ? textFrame.height * pageContentHeight * .85 : (textBox.fontSize ?? page.textSize ?? 24) * 1.2 * previewScale),
                          includeFontPadding: !shapeText,
                          fontWeight: (textBox.fontWeight as "400" | "500" | "600" | "700") ?? "700",
                          fontStyle: (textBox.fontStyle as "normal" | "italic") ?? "normal",
                          fontFamily: textBox.fontFamily ?? page.textFontFamily,
                          textAlign: (textBox.textAlign ?? "center") as "left" | "center" | "right"
                        }
                      ]}
                    >
                      {textBox.text}
                    </Text>
                    </View>
                  </View>
                );
              })}
  </View>;
}
const styles = StyleSheet.create({
  slotFrame: { position: "absolute", overflow: "hidden" },
  slotImage: { position: "absolute" },
  textBox: { position: "absolute", justifyContent: "center", overflow: "hidden" },
  textBoxText: { }
});
