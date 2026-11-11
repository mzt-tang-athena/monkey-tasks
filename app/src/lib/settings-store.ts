import * as React from "react";
import { loadSettings, saveSetting, type Settings } from "@/lib/settings";

/**
 * The live copy of the settings that more than one screen changes.
 * `lib/settings.ts` owns persistence; this store is what tells an
 * already-mounted screen that a saved value moved.
 *
 * The theme keeps its own owner in `ThemeProvider`, because the whole
 * tree reads it from React context.
 */

const listeners = new Set<() => void>();

/** Save one setting and tell every mounted reader to read it back. */
export function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): void {
  saveSetting(key, value);
  for (const listener of listeners) {
    listener();
  }
}

/**
 * One setting as a live pair. The value starts from the saved one, and
 * a write from any screen updates this one. A reader that mounts after
 * a write reads the saved value, so a tab that was never open agrees
 * with the tab that was.
 */
export function useSetting<K extends keyof Settings>(
  key: K,
): [Settings[K], (value: Settings[K]) => void] {
  const [value, setValue] = React.useState<Settings[K]>(
    () => loadSettings()[key],
  );

  React.useEffect(() => {
    const sync = () => setValue(loadSettings()[key]);
    listeners.add(sync);
    // A write may have landed between this render and its effects.
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, [key]);

  const set = React.useCallback(
    (next: Settings[K]) => setSetting(key, next),
    [key],
  );

  return [value, set];
}
