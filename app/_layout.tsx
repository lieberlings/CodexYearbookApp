import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "../src/context/AppContext";

LogBox.ignoreLogs(["Looks like you have configured linking in multiple places"]);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
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
        </Stack>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
