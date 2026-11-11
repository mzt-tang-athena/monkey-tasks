import { useSetting } from "@/lib/settings-store";
import type { SortMode } from "@/lib/settings";

/** The list order the user picked, live across the Lists screen and
    the settings screen. */
export function useSortMode(): {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
} {
  const [sortMode, setSortMode] = useSetting("sortMode");
  return { sortMode, setSortMode };
}
