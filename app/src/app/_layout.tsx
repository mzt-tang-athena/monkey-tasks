import { useState } from "react";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { makeQueryClient } from "../store/query-client";
import { TasksProvider } from "../store/tasks";
import { ErrorBoundary } from "../components/ErrorBoundary";
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
  // One client per app instance. Building it during render would throw the
  // cache away on every render, and every mounted query would refetch.
  const [queryClient] = useState(() => makeQueryClient());

  return (
    // Gestures only fire on native when the tree sits under this root.
    <GestureHandlerRootView style={styles.root}>
      {/* The keyboard provider tracks the real keyboard height on the
          device. Android with edge to edge never resizes the window for
          the keyboard, so the app has to know the height itself. */}
      <KeyboardProvider>
        {/* Render errors inside a screen show the boundary panel
            instead of unmounting to a blank app. It wraps the data
            layer so a provider that throws still renders the panel.
            installErrorAlert above still covers errors thrown
            outside render. */}
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <TasksProvider>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="dev" options={{ title: "Diagnostics" }} />
              </Stack>
            </TasksProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
