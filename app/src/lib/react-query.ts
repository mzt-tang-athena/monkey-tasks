import { AppState, Platform } from "react-native";
import {
  MutationCache,
  QueryClient,
  focusManager,
} from "@tanstack/react-query";

/** Whether a mutation's result asks to stay on screen as a notice. */
function hasNotice(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data != null &&
    typeof (data as { notice?: unknown }).notice === "string"
  );
}

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

  // A write that failed stays in the cache, where the failure list
  // reads it, until the user dismisses or retries it. A write that
  // succeeded leaves the cache at once, unless its result carries a
  // notice for the user, so the cache does not grow with every tap.
  // It leaves after its last state change, never before: until then it
  // still counts as a pending write for the reads that wait on it.
  const mutationCache = new MutationCache();
  mutationCache.subscribe((event) => {
    if (
      event.type === "updated" &&
      event.action.type === "success" &&
      !hasNotice(event.mutation.state.data)
    ) {
      mutationCache.remove(event.mutation);
    }
  });

  return new QueryClient({
    mutationCache,
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
        // The vault is a folder on the device, not a server. A read
        // never waits for a network, even when a future NetInfo hookup
        // reports the phone offline (ADR 0003).
        networkMode: "always",
      },
      mutations: {
        // A note write is not safe to repeat blindly: a second attempt
        // would rewrite a file another app may have changed since.
        retry: 0,
        // A write to the folder never pauses for a network either.
        networkMode: "always",
      },
    },
  });
}
