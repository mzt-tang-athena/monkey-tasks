import type { Toggle } from "@/lib/settings";

/**
 * The list tabs' names and order, with no store behind it. The Lists
 * strip and the command pane's Switch list both read it, so a tab never
 * moves in one place and stays in the other.
 *
 * The order is the accepted one: the built-in lists that sit before
 * Main, then Main, then the ones that sit after it, then every list
 * note by name. Main is fixed, so a list note named Focus or Main
 * cannot make a second tab. Today leads while it is on, and Main leads
 * when it is off (ADR 20261125-today-list).
 */

/** Main holds the unfiled tasks: those with no list. */
export const MAIN_LIST = "Main";

/** The built-in Today list's tab name. It has no list note behind it. */
export const TODAY_LIST = "Today";

/** The switches the built-in tabs read: one setting each. */
export type BuiltinTabs = { todayList: Toggle };

/**
 * Every optional built-in tab, with its setting and its side of Main.
 * The Board joins this table on the after side, as ADR
 * 20261125-deed-board-is-the-kanban-list places it.
 */
const BUILTIN_TABS: {
  setting: keyof BuiltinTabs;
  name: string;
  beforeMain: boolean;
}[] = [{ setting: "todayList", name: TODAY_LIST, beforeMain: true }];

export function listTabs(
  lists: readonly string[],
  builtins: BuiltinTabs,
): string[] {
  const on = BUILTIN_TABS.filter((tab) => builtins[tab.setting] === "on");
  const tabs = [
    ...on.filter((tab) => tab.beforeMain).map((tab) => tab.name),
    MAIN_LIST,
    ...on.filter((tab) => !tab.beforeMain).map((tab) => tab.name),
  ];
  for (const name of lists) {
    if (!tabs.includes(name)) {
      tabs.push(name);
    }
  }
  return tabs;
}
