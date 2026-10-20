import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Lists" }}
      />
      <Tabs.Screen
        name="planner"
        options={{ title: "Planner" }}
      />
    </Tabs>
  );
}
