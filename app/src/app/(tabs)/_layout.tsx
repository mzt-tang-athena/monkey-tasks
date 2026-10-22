import { Tabs } from "expo-router";

/**
 * Variant B brings its own chrome: a paper background, no native
 * header, and a slim custom bottom bar instead of the tab bar.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Lists" }} />
      <Tabs.Screen name="planner" options={{ title: "Planner" }} />
    </Tabs>
  );
}
