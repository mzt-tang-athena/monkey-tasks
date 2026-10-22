import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { KeyboardProvider } from "react-native-keyboard-controller";
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
    // The keyboard provider tracks the real keyboard height on the
    // device. Android with edge to edge never resizes the window for
    // the keyboard, so the app has to know the height itself.
    <KeyboardProvider>
      <TasksProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="dev" options={{ title: "Diagnostics" }} />
        </Stack>
      </TasksProvider>
    </KeyboardProvider>
  );
}
