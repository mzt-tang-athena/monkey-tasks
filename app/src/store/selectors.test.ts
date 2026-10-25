import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../features/tasks/query";
import {
  isHiddenOccurrence,
  selectOpenTasks,
  selectSections,
  selectTabTasks,
} from "./selectors";

// The selectors only read day boundaries out of `now`, so a pinned
// local midnight keeps the ordering deterministic in any timezone.
const NOW = new Date(2026, 9, 22);

type TaskFields = {
  due?: string;
  order?: number;
  lists?: string[];
  completed?: string;
  recurrence?: string;
  "recurrence previous"?: string;
};

function task(name: string, fields: TaskFields = {}): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  const data: TaskFrontmatter = {
    kind: "[[tasks]]",
    created: "2026-10-20",
    ...fields,
  };
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data,
  };
}

const names = (items: TaskItem[]): string[] => items.map((item) => item.name);

describe("selectOpenTasks", () => {
  it("flattens overdue, today, undated, then upcoming days", () => {
    // Built out of order on purpose: the pool follows due dates and
    // titles, not the store's row order.
    const tasks = [
      task("Later", { due: "2026-10-26" }),
      task("Undated B", {}),
      task("Today late", { due: "2026-10-22T18:00" }),
      task("Overdue B", { due: "2026-10-19" }),
      task("Tomorrow", { due: "2026-10-23" }),
      task("Undated A", {}),
      task("Today early", { due: "2026-10-22T09:00" }),
      task("Overdue A", { due: "2026-10-18" }),
    ];

    expect(names(selectOpenTasks(tasks, NOW))).toEqual([
      "Overdue A",
      "Overdue B",
      "Today early",
      "Today late",
      "Undated A",
      "Undated B",
      "Tomorrow",
      "Later",
    ]);
  });

  it("drops completed tasks from the open pool", () => {
    const tasks = [
      task("Done", { due: "2026-10-20", completed: "2026-10-21" }),
      task("Open", { due: "2026-10-20" }),
    ];

    expect(names(selectOpenTasks(tasks, NOW))).toEqual(["Open"]);
  });

  it("returns an empty pool for no tasks", () => {
    expect(selectOpenTasks([], NOW)).toEqual([]);
  });
});

describe("selectTabTasks", () => {
  const tasks = [
    task("Plan week", { lists: ["[[Focus]]"] }),
    task("Buy milk", { lists: ["[[Work]]"] }),
    task("Call bank", {}),
    task("Errand", { lists: ["[[Errands]]"] }),
    task("Deep work", { lists: ["[[Work]]", "[[Focus]]"] }),
    task("Second focus", { lists: ["[[Focus]]"] }),
  ];

  it("shows only Focus list tasks on the Focus tab", () => {
    expect(names(selectTabTasks(tasks, "Focus", NOW))).toEqual([
      "Plan week",
      "Deep work",
      "Second focus",
    ]);
  });

  it("shows every task on Main, ADR 0015", () => {
    // Main is the catch-all, so Focus and Work tasks show here too. A
    // task on both lists appears once.
    expect(names(selectTabTasks(tasks, "Main", NOW))).toEqual([
      "Plan week",
      "Buy milk",
      "Call bank",
      "Errand",
      "Deep work",
      "Second focus",
    ]);
  });

  it("filters a named list tab by the wikilink in tasks", () => {
    // Work is a list note now, so it gets a tab of its own; the tab
    // name matches the wikilink, not the file name with an extension.
    expect(names(selectTabTasks(tasks, "Work", NOW))).toEqual([
      "Buy milk",
      "Deep work",
    ]);
    expect(names(selectTabTasks(tasks, "Errands", NOW))).toEqual(["Errand"]);
  });

  it("shows nothing for a tab with no matching tasks", () => {
    expect(selectTabTasks(tasks, "Someday", NOW)).toEqual([]);
  });

  it("hides a spawned occurrence until its due day", () => {
    const spawn = task("Water plants", {
      due: "2026-10-30",
      recurrence: "FREQ=WEEKLY",
      "recurrence previous": "[[Water plants 2026-10-23]]",
    });
    const overdue = task("Old spawn", {
      due: "2026-10-01",
      recurrence: "FREQ=WEEKLY",
      "recurrence previous": "[[Old spawn 2026-09-24]]",
    });

    expect(names(selectTabTasks([spawn, overdue], "Main", NOW))).toEqual([
      "Old spawn",
    ]);
    expect(isHiddenOccurrence(spawn, NOW)).toBe(true);
    expect(isHiddenOccurrence(overdue, NOW)).toBe(false);
  });

  it("does not drop a list tab's tasks from Main", () => {
    const focus = selectTabTasks(tasks, "Focus", NOW);
    const mainUris = new Set(
      selectTabTasks(tasks, "Main", NOW).map((item) => item.uri),
    );

    expect(focus.every((item) => mainUris.has(item.uri))).toBe(true);
  });
});

describe("selectSections", () => {
  it("orders dated sections and labels upcoming days with dayLabel", () => {
    const visible = [
      task("Late today", { due: "2026-10-22T16:00" }),
      task("Past", { due: "2026-10-21" }),
      task("Tomorrow", { due: "2026-10-23" }),
      task("Saturday late", { due: "2026-10-24T14:00" }),
      task("Saturday early", { due: "2026-10-24T08:00" }),
      task("Far future", { due: "2026-11-03" }),
      task("No date", {}),
    ];

    const sections = selectSections(visible, NOW);

    expect(sections.map((section) => section.title)).toEqual([
      "Past",
      "Today",
      "Tomorrow",
      "Sat, 24 Oct",
      "Tue, 3 Nov",
      "No date",
    ]);
    expect(sections.map((section) => section.tone)).toEqual([
      "danger",
      "ink",
      "muted",
      "muted",
      "muted",
      "muted",
    ]);
    expect(sections.map((section) => names(section.items))).toEqual([
      ["Past"],
      ["Late today"],
      ["Tomorrow"],
      ["Saturday early", "Saturday late"],
      ["Far future"],
      ["No date"],
    ]);
  });

  it("orders each section by the manual order, unordered last", () => {
    const visible = [
      task("Third", { due: "2026-10-22", order: 3 }),
      task("First", { due: "2026-10-22", order: 1 }),
      task("No order B", { due: "2026-10-22" }),
      task("Second", { due: "2026-10-22", order: 2 }),
      task("No order A", { due: "2026-10-22" }),
    ];

    const [today] = selectSections(visible, NOW, "manual");

    expect(names(today.items)).toEqual([
      "First",
      "Second",
      "Third",
      "No order A",
      "No order B",
    ]);
  });

  it("omits sections with no items", () => {
    const onlyToday = [task("Today", { due: "2026-10-22" })];

    expect(selectSections(onlyToday, NOW).map((section) => section.title)).toEqual([
      "Today",
    ]);
    expect(selectSections([], NOW)).toEqual([]);
  });

  it("drops completed rows instead of giving them a section", () => {
    const visible = [
      task("Done", { due: "2026-10-21", completed: "2026-10-21" }),
      task("Open", { due: "2026-10-21" }),
    ];

    const sections = selectSections(visible, NOW);

    expect(sections.map((section) => section.title)).toEqual(["Past"]);
    expect(sections.map((section) => names(section.items))).toEqual([["Open"]]);
  });
});
