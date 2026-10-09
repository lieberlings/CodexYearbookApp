import { ScrollView, Text, View } from "react-native";
import { backgroundPacks } from "../../../library/backgrounds";
import { ColorPicker } from "../../../ui/ColorPicker";
import { BackgroundThumbnail } from "../EditorControls";
import { styles } from "../styles";

export type PageBackgroundChange = { backgroundColor?: string; backgroundAssetId?: string };

export function BackgroundPanel({
  backgroundColor,
  backgroundAssetId,
  themeColors,
  onChange
}: {
  backgroundColor?: string;
  backgroundAssetId?: string;
  themeColors: string[];
  onChange: (change: PageBackgroundChange) => void;
}) {
  return (
    <ScrollView
      style={styles.backgroundPickerScroll}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      contentContainerStyle={styles.backgroundPicker}
    >
      <ColorPicker
        label="Page color"
        value={backgroundAssetId ? undefined : backgroundColor}
        themeColors={themeColors}
        onChange={(color) => onChange({ backgroundColor: color, backgroundAssetId: undefined })}
      />
      {backgroundPacks.map((pack) => (
        <View key={pack.id} style={styles.controlGroup}>
          <Text style={styles.controlGroupLabel}>{pack.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.backgroundPackRow}>
            {pack.backgrounds.map((background) => (
              <BackgroundThumbnail
                key={background.id}
                assetId={background.id}
                backgroundColor={background.backgroundColor}
                active={backgroundAssetId === background.id}
                label={`${background.number}`}
                onPress={() =>
                  onChange({
                    backgroundColor: background.backgroundColor,
                    backgroundAssetId: background.id
                  })
                }
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}
