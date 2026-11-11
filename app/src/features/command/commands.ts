import type { Command } from "./model";

/**
 * Everything the commands read. The provider passes plain values and
 * plain functions, so this module stays free of hooks and a test can
 * call it with a fake context. The labels for the current sort order
 * and palette arrive already written, because their registries load
 * React Native and this module stays importable in node.
 */
export type CommandSources = {
  /** The current order, as the Settings screen names it. */
  sortLabel: string;
  /** The current palette, as the Settings screen names it. */
  themeLabel: string;
  /** The list the switch command goes to, or null when only Main exists. */
  nextList: string | null;
  addTask: () => void;
  goLists: () => void;
  goPlanner: () => void;
  switchList: () => void;
  openSettings: () => void;
  openDiagnostics: () => void;
};

/**
 * The pane's commands, in their resting order. The recent list reorders
 * them at draw time. The switch row names the list it goes to, so a
 * press always changes the screen, and repeated presses reach every
 * tab. Theme and Sort mode open the Settings screen, which owns both
 * pickers, instead of duplicating them here.
 */
export function buildCommands(sources: CommandSources): Command[] {
  const switches: Command[] =
    sources.nextList == null
      ? []
      : [
          {
            id: "switch",
            label: "Switch list",
            hint: `To ${sources.nextList}`,
            keywords: ["list", sources.nextList],
            run: sources.switchList,
          },
        ];

  return [
    {
      id: "capture",
      label: "Add task",
      hint: "Capture",
      keywords: ["capture", "new task"],
      run: sources.addTask,
    },
    {
      id: "lists",
      label: "Go to Lists",
      keywords: ["tasks", "home"],
      run: sources.goLists,
    },
    {
      id: "planner",
      label: "Go to Planner",
      keywords: ["calendar", "day", "week", "month"],
      run: sources.goPlanner,
    },
    ...switches,
    {
      id: "sort",
      label: "Sort mode",
      hint: sources.sortLabel,
      keywords: ["order", "sort", "due", "manual"],
      run: sources.openSettings,
    },
    {
      id: "theme",
      label: "Theme",
      hint: sources.themeLabel,
      keywords: ["appearance", "palette", "dark", "light"],
      run: sources.openSettings,
    },
    {
      id: "settings",
      label: "Settings",
      keywords: ["preferences"],
      run: sources.openSettings,
    },
    {
      id: "diagnostics",
      label: "Diagnostics",
      keywords: ["dev", "debug", "crash"],
      run: sources.openDiagnostics,
    },
  ];
}
