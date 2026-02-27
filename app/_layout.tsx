import { Stack } from "expo-router";
import { AppProvider } from "../src/context/AppContext";

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#f8fafc" },
          headerTintColor: "#0f172a"
        }}
      >
        <Stack.Screen name="index" options={{ title: "Projects" }} />
        <Stack.Screen name="project/[id]" options={{ title: "Project Details" }} />
        <Stack.Screen name="project/[id]/preview" options={{ title: "Project Preview" }} />
        <Stack.Screen name="memory/[id]" options={{ title: "Memory Details" }} />
        <Stack.Screen name="prompts" options={{ title: "Prompts" }} />
        <Stack.Screen name="dev/block-layout-lab" options={{ title: "Block Layout Lab" }} />
      </Stack>
    </AppProvider>
  );
}
