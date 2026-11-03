import * as React from "react";
import { loadSettings, saveSetting, type SortMode } from "@/lib/settings";

/** The list order the user picked. It starts from the saved setting,
    and a change saves at once. */
export function useSortMode(): {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
} {
  const [sortMode, setMode] = React.useState<SortMode>(
    () => loadSettings().sortMode,
  );
  const setSortMode = React.useCallback((mode: SortMode) => {
    setMode(mode);
    saveSetting("sortMode", mode);
  }, []);
  return { sortMode, setSortMode };
}
