import * as React from "react";
import { router } from "expo-router";
import { CommandPane } from "@/components/ui/command-pane";
import {
  CommandPaneContext,
  type CommandPaneValue,
} from "@/hooks/use-command-pane";
import { requestCapture } from "@/lib/capture-request";
import { selectList, useSelectedList } from "@/lib/selected-list";
import { SORT_LABELS } from "@/lib/settings";
import { useSetting } from "@/lib/settings-store";
import { useStoreMeta } from "@/stores/tasks/task-state";
import { THEME_NAMES } from "@/theme/palettes";
import { useTheme } from "@/theme/theme-provider";
import { buildCommands } from "./commands";
import { orderCommands, recordRecent } from "./model";

/**
 * Hosts the command pane above every screen. It reads the list names,
 * the current list, the sort order and the palette from the shared
 * providers, so the pane needs no screen to open or to run a command.
 * The capture dock on the focused tab answers Add task.
 */
export function CommandPaneProvider({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = React.useState(false);
  const [recent, setRecent] = React.useState<string[]>([]);
  const { lists } = useStoreMeta();
  const currentList = useSelectedList();
  const [sortMode] = useSetting("sortMode");
  const { name: theme } = useTheme();

  // The tab order: Main, then the list notes. A press moves one tab
  // along and wraps, so every tab is reachable.
  const tabs = ["Main", ...lists];
  const at = tabs.indexOf(currentList);
  const nextList = tabs.length > 1 ? tabs[(at + 1) % tabs.length] : null;

  const value = React.useMemo<CommandPaneValue>(
    () => ({ show: () => setShown(true) }),
    [],
  );

  const commands = buildCommands({
    sortLabel: SORT_LABELS[sortMode],
    themeLabel: THEME_NAMES[theme],
    nextList,
    addTask: requestCapture,
    goLists: () => router.navigate("/"),
    goPlanner: () => router.navigate("/planner"),
    switchList: () => {
      if (nextList != null) {
        selectList(nextList);
      }
      router.navigate("/");
    },
    openSettings: () => router.push("/settings"),
    openDiagnostics: () => router.push("/dev"),
  });

  const rows = orderCommands(commands, recent).map((command) => ({
    id: command.id,
    label: command.label,
    hint: command.hint,
    keywords: command.keywords,
    onPress: () => {
      setRecent((current) => recordRecent(current, command.id));
      setShown(false);
      command.run();
    },
  }));

  return (
    <CommandPaneContext.Provider value={value}>
      {children}
      <CommandPane
        open={shown}
        onClose={() => setShown(false)}
        label="Commands"
        commands={rows}
      />
    </CommandPaneContext.Provider>
  );
}
