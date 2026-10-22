import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { TasksProvider } from "../store/tasks";
import { installErrorAlert } from "../lib/errors";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Before anything renders: a release build closes on the first
// uncaught error, and a closed app cannot report what broke.
installErrorAlert();

export default function RootLayout() {
  return (
    // Gestures only fire on native when the tree sits under this root.
    <GestureHandlerRootView style={styles.root}>
      {/* The keyboard provider tracks the real keyboard height on the
          device. Android with edge to edge never resizes the window for
          the keyboard, so the app has to know the height itself. */}
      <KeyboardProvider>
        <TasksProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="dev" options={{ title: "Diagnostics" }} />
          </Stack>
        </TasksProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
