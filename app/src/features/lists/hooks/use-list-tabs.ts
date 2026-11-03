import * as React from "react";
import type { CaptureTarget } from "@/types/task";
import { useListTabs, type ListTab } from "@/stores/tasks/selectors";
import type { PagerSide } from "@/components/swipe-pager";

/**
 * The Lists screen's tab state: Main first, then one tab per list
 * note. It also gives the capture dock its targets and the pager its
 * two questions, "is there a page that way?" and "turn to it".
 */
export function useListTabState() {
  const tabs = useListTabs();
  const [selected, setSelected] = React.useState<ListTab>("Main");
  // A list note can vanish while its tab is open. Main takes over.
  const tab = tabs.includes(selected) ? selected : "Main";

  // The capture targets follow the tab order: Main, then one list
  // target per list note. Main stores nothing; a list target writes
  // its name into the captured task's lists property.
  const targets = React.useMemo<CaptureTarget[]>(
    () =>
      tabs.map((name) =>
        name === "Main"
          ? { kind: "main" as const }
          : { kind: "list" as const, name },
      ),
    [tabs],
  );

  // The pill preselects the active tab's target. Main is the fallback
  // when the tab has no target of its own.
  const defaultTargetIndex = React.useMemo(() => {
    const index = targets.findIndex((target) =>
      tab === "Main"
        ? target.kind === "main"
        : target.kind === "list" && target.name === tab,
    );
    return index === -1 ? 1 : index;
  }, [targets, tab]);

  const canGo = React.useCallback(
    (dir: PagerSide) => {
      const index = tabs.indexOf(tab);
      if (index === -1) {
        return false;
      }
      return dir === "left" ? index + 1 < tabs.length : index > 0;
    },
    [tabs, tab],
  );

  const onPage = React.useCallback(
    (dir: PagerSide) => {
      // Step from the derived tab, as canGo does. The raw selection can
      // name a vanished list.
      const next = tabs[tabs.indexOf(tab) + (dir === "left" ? 1 : -1)];
      if (next != null) {
        setSelected(next);
      }
    },
    [tabs, tab],
  );

  /** The tab the finger travels toward, or null at either end. */
  const neighbor = React.useCallback(
    (dir: PagerSide): ListTab | null => {
      const index = tabs.indexOf(tab);
      return index === -1
        ? null
        : (tabs[dir === "left" ? index + 1 : index - 1] ?? null);
    },
    [tabs, tab],
  );

  return {
    tabs,
    tab,
    setTab: setSelected,
    targets,
    defaultTargetIndex,
    canGo,
    onPage,
    neighbor,
  };
}
