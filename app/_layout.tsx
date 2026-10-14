import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CloudProvider } from "../src/cloud/CloudContext";
import { AppProvider } from "../src/context/AppContext";

LogBox.ignoreLogs(["Looks like you have configured linking in multiple places"]);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <CloudProvider>
          <Stack
            screenOptions={{
              orientation: "portrait",
              headerStyle: { backgroundColor: "#f8fafc" },
              headerTintColor: "#0f172a"
            }}
          >
            <Stack.Screen name="index" options={{ title: "Projects" }} />
            <Stack.Screen name="project/[id]" options={{ title: "Project Details" }} />
            <Stack.Screen name="project/[id]/preview" options={{ title: "Project Preview", orientation: "all" }} />
            <Stack.Screen name="project/[id]/cover" options={{ title: "Design cover" }} />
            <Stack.Screen name="memory/[id]" options={{ title: "Memory Details" }} />
            <Stack.Screen name="prompts" options={{ title: "Prompts" }} />
            <Stack.Screen name="dev/block-layout-lab" options={{ title: "Block Layout Lab" }} />
            <Stack.Screen name="account" options={{ title: "Account" }} />
            <Stack.Screen name="join" options={{ title: "Join a project" }} />
            <Stack.Screen name="project/[id]/share" options={{ title: "Share" }} />
            <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          </Stack>
        </CloudProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
