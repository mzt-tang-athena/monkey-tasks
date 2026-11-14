import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import {
  groupByDue,
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
  created?: string;
  list?: string;
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
      task("Done late", {
        due: "2026-10-20",
        completed: "2026-10-21T18:08",
      }),
      task("Open", { due: "2026-10-20" }),
    ];

    expect(names(selectOpenTasks(tasks, NOW))).toEqual(["Open"]);
  });

  it("files both completion shapes under completed", () => {
    const tasks = [
      task("Done", { due: "2026-10-20", completed: "2026-10-21" }),
      task("Done late", {
        due: "2026-10-20",
        completed: "2026-10-21T18:08",
      }),
      task("Open", { due: "2026-10-20" }),
    ];

    const groups = groupByDue(tasks, NOW);

    expect(names(groups.completed).sort()).toEqual(["Done", "Done late"]);
    expect(names(groups.overdue)).toEqual(["Open"]);
  });

  it("returns an empty pool for no tasks", () => {
    expect(selectOpenTasks([], NOW)).toEqual([]);
  });
});

describe("selectTabTasks", () => {
  const tasks = [
    task("Plan week", { list: "[[Focus]]" }),
    task("Buy milk", { list: "[[Work]]" }),
    task("Call bank", {}),
    task("Errand", { list: "[[Errands]]" }),
    task("Deep work", { list: "[[Work]]" }),
    task("Second focus", { list: "[[Focus]]" }),
  ];

  it("shows an unfiled task on Main only", () => {
    expect(names(selectTabTasks(tasks, "Main", NOW))).toEqual(["Call bank"]);
  });

  it("shows a listed task on its tab and not on Main", () => {
    expect(names(selectTabTasks(tasks, "Focus", NOW))).toEqual([
      "Plan week",
      "Second focus",
    ]);
    expect(names(selectTabTasks(tasks, "Main", NOW))).not.toContain("Plan week");
  });

  it("returns a task to Main when its list is cleared", () => {
    const listed = task("Water plants", { list: "[[Home]]" });

    expect(names(selectTabTasks([listed], "Home", NOW))).toEqual([
      "Water plants",
    ]);
    expect(names(selectTabTasks([listed], "Main", NOW))).toEqual([]);

    listed.data!.list = null;

    expect(names(selectTabTasks([listed], "Main", NOW))).toEqual([
      "Water plants",
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

  it("falls back to the creation date before the name", () => {
    const visible = [
      task("Bought later", { due: "2026-10-22", created: "2026-10-21" }),
      task("Bought first", { due: "2026-10-22", created: "2026-10-19" }),
      task("Same day, A", { due: "2026-10-22", created: "2026-10-20" }),
      task("Same day, B", { due: "2026-10-22", created: "2026-10-20" }),
    ];

    const [today] = selectSections(visible, NOW, "manual");

    expect(names(today.items)).toEqual([
      "Bought first",
      "Same day, A",
      "Same day, B",
      "Bought later",
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
