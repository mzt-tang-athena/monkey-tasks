import { Tabs } from "expo-router";
import { theme } from "../../theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.paper },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: theme.weights.bold },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
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
