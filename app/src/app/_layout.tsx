import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { makeQueryClient } from "@/lib/react-query";
import { TasksProvider } from "@/stores/tasks/tasks-provider";
import { VaultProvider } from "@/lib/vault/vault-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { OverlayHost } from "@/components/ui/overlay-host";
import { CommandPaneProvider } from "@/features/command/command-pane-provider";
import { TaskEditorProvider } from "@/features/task-editor/task-editor-provider";
import { ThemeProvider } from "@/theme/theme-provider";
import { installErrorAlert } from "@/lib/errors";
import { installCrashTestHooks } from "@/lib/crash-test-hooks";
import { openTask } from "@/lib/task-route";
import {
  addAlertResponseListener,
  takeAlertResponse,
  type AlertResponse,
} from "@/lib/notifications";
import { acknowledgeRing } from "@/stores/tasks/reminder-sync";

// Before anything renders: a release build closes on the first
// uncaught error, and a closed app cannot report what broke.
installErrorAlert();
installCrashTestHooks();

/**
 * A tap on an alert clears the group it rang for and opens its task.
 * The listener covers a tap while the app runs; the stored response
 * covers the tap that started the app.
 */
function useAlertResponses(): void {
  useEffect(() => {
    const handle = (alert: AlertResponse) => {
      if (alert.base != null) {
        void acknowledgeRing({ uri: alert.uri, base: alert.base });
      }
      openTask(alert.uri);
    };
    const last = takeAlertResponse();
    if (last != null) {
      handle(last);
    }
    const subscription = addAlertResponseListener(handle);
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  // One client per app instance. Building it during render would throw the
  // cache away on every render, and every mounted query would refetch.
  const [queryClient] = useState(() => makeQueryClient());
  useAlertResponses();

  return (
    // Gestures only fire on native when the tree sits under this root.
    <GestureHandlerRootView style={styles.root}>
      {/* The keyboard provider tracks the real keyboard height on the
          device. Android with edge to edge never resizes the window for
          the keyboard, so the app has to know the height itself. */}
      <KeyboardProvider>
        {/* One palette for every screen, sheet and toast, so a switch
            repaints the whole tree without a remount. */}
        <ThemeProvider>
          {/* Render errors inside a screen show the boundary panel
              instead of unmounting to a blank app. It wraps the data
              layer so a provider that throws still renders the panel.
              installErrorAlert above still covers errors thrown
              outside render. */}
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              {/* The vault the store reads: SAF on a phone, the memory
                  vault in the browser (ADR 0037). */}
              <VaultProvider>
                <TasksProvider>
                  {/* Menus, sheets and toasts draw here, above every
                      screen, in one z order (ADR 0040). */}
                  <OverlayHost>
                    <CommandPaneProvider>
                      {/* The task editor sheet and its toasts draw over
                          every screen, so a write outlives the sheet
                          that started it. */}
                      <TaskEditorProvider>
                      <Stack>
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="dev" options={{ title: "Diagnostics" }} />
                        {/* The screen draws its own back button, so the
                            stack's header never covers the page. */}
                        <Stack.Screen name="settings" options={{ headerShown: false }} />
                      </Stack>
                      </TaskEditorProvider>
                    </CommandPaneProvider>
                  </OverlayHost>
                </TasksProvider>
              </VaultProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
