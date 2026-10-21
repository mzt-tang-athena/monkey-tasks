import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { TasksProvider } from "../store/tasks";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  return (
    <TasksProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="dev" options={{ title: "Diagnostics" }} />
      </Stack>
    </TasksProvider>
  );
}
