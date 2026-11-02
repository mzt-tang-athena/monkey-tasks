import { AppState, Platform } from "react-native";
import { QueryClient, focusManager } from "@tanstack/react-query";

/**
 * The app's query client, and the one place the store's cache policy is
 * set.
 *
 * The vault is the slow, external source: reading it costs a folder
 * scan, so a query is never re-read on a timer or on a remount. Reads
 * happen when the store mounts, when the folder is granted, on an
 * explicit refresh, and when the app returns to the foreground.
 *
 * Focus is the foreground signal. TanStack's default listener watches
 * `document.visibilitychange`, which a device does not have, so a
 * native build maps React Native's AppState onto the focus manager.
 * The browser keeps the built-in listener.
 */
export function makeQueryClient(): QueryClient {
  if (Platform.OS !== "web") {
    focusManager.setEventListener((onFocus) => {
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          onFocus();
        }
      });
      return () => subscription.remove();
    });
  }

  return new QueryClient({
    defaultOptions: {
      queries: {
        // The list is local first: a write updates the cache and the
        // vault is not read again behind it. A cache entry never goes
        // stale on its own, so nothing refetches it by accident.
        staleTime: Infinity,
        // Rows must survive a screen unmount and remount: the folder is
        // read once, not once per tab visit.
        gcTime: Infinity,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: false,
      },
      mutations: {
        // A note write is not safe to repeat blindly: a second attempt
        // would rewrite a file another app may have changed since.
        retry: 0,
      },
    },
  });
}
