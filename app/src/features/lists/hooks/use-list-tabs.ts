import * as React from "react";
import type { CaptureTarget } from "@/types/task";
import { recordBreadcrumb } from "@/lib/breadcrumbs";
import { MAIN_LIST, TODAY_LIST } from "@/lib/list-tabs";
import { selectList, useSelectedList } from "@/lib/selected-list";
import { useSetting } from "@/lib/settings-store";
import { useListTabs, type ListTab } from "@/stores/tasks/selectors";

/**
 * The Lists screen's tab state: the built-in lists that are on, then
 * Main, then one tab per list note. The pager reads the tab's position
 * as its index, and a landing writes the tab back. The capture dock
 * reads the targets.
 *
 * A fresh start has no picked tab, so it opens on the first one. Today
 * leads while it is on, and Main leads when it is off. Nothing here
 * assumes Main sits at index 0.
 */
export function useListTabState() {
  const [todayList] = useSetting("todayList");
  const builtins = React.useMemo(() => ({ todayList }), [todayList]);
  const tabs = useListTabs(builtins);
  const selected = useSelectedList();
  // A list note can vanish while its tab is open, and Today can be
  // switched off. The first tab takes over.
  const tab =
    selected != null && tabs.includes(selected)
      ? selected
      : (tabs[0] ?? MAIN_LIST);
  const index = Math.max(0, tabs.indexOf(tab));
  const bounds = React.useMemo(
    () => ({ first: 0, last: Math.max(0, tabs.length - 1) }),
    [tabs.length],
  );

  // The capture targets follow the tab order. Main stores nothing, and
  // neither does Today: Today dates the capture instead. A list target
  // writes its name into the captured task's list property.
  const targets = React.useMemo<CaptureTarget[]>(
    () =>
      tabs.map((name) => {
        if (name === MAIN_LIST) {
          return { kind: "main" as const };
        }
        if (name === TODAY_LIST) {
          return { kind: "today" as const };
        }
        return { kind: "list" as const, name };
      }),
    [tabs],
  );

  // The pill preselects the active tab's target. Main is the fallback
  // when the tab has no target of its own.
  const defaultTargetIndex = React.useMemo(() => {
    const found = targets.findIndex((target) =>
      tab === MAIN_LIST
        ? target.kind === "main"
        : tab === TODAY_LIST
          ? target.kind === "today"
          : target.kind === "list" && target.name === tab,
    );
    return found === -1 ? 1 : found;
  }, [targets, tab]);

  const setTab = React.useCallback((next: ListTab) => {
    recordBreadcrumb("tab", next);
    selectList(next);
  }, []);

  const onPage = React.useCallback(
    (next: number) => {
      const name = tabs[next];
      if (name != null) {
        recordBreadcrumb("tab", name);
        selectList(name);
      }
    },
    [tabs],
  );

  return {
    tabs,
    tab,
    setTab,
    targets,
    defaultTargetIndex,
    index,
    bounds,
    onPage,
  };
}
