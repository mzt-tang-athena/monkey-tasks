import * as React from "react";
import type { CaptureTarget } from "@/types/task";
import { recordBreadcrumb } from "@/lib/breadcrumbs";
import { selectList, useSelectedList } from "@/lib/selected-list";
import { useListTabs, type ListTab } from "@/stores/tasks/selectors";

/**
 * The Lists screen's tab state: Main first, then one tab per list
 * note. The pager reads the tab's position as its index, and a landing
 * writes the tab back. The capture dock reads the targets.
 */
export function useListTabState() {
  const tabs = useListTabs();
  const selected = useSelectedList();
  // A list note can vanish while its tab is open. Main takes over.
  const tab = tabs.includes(selected) ? selected : "Main";
  const index = Math.max(0, tabs.indexOf(tab));
  const bounds = React.useMemo(
    () => ({ first: 0, last: Math.max(0, tabs.length - 1) }),
    [tabs.length],
  );

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
    const found = targets.findIndex((target) =>
      tab === "Main"
        ? target.kind === "main"
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
