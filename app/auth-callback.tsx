import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { completeAuthRedirect } from "../src/cloud/auth";
import { colors } from "../src/ui/theme";

// Where Google sign-in returns to when Android opens the app from the link
// rather than handing it back to the browser tab.
export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  useEffect(() => {
    if (!url) return;
    void completeAuthRedirect(url)
      .catch((error) => console.warn("Sign-in redirect failed", error))
      .finally(() => router.replace("/account"));
  }, [url]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
