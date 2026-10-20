import { Tabs } from "expo-router";

/**
 * Design variant C drives navigation itself: each screen renders the
 * shared BottomNavbar, so the native tab bar stays hidden.
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
