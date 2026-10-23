import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../features/tasks/query";
import { selectOpenTasks, selectSections, selectTabTasks } from "./selectors";

// The selectors only read day boundaries out of `now`, so a pinned
// local midnight keeps the ordering deterministic in any timezone.
const NOW = new Date(2026, 9, 22);

type TaskFields = {
  due?: string;
  lists?: string[];
  completed?: string;
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
    expect(names(selectTabTasks(tasks, "Focus"))).toEqual([
      "Plan week",
      "Deep work",
      "Second focus",
    ]);
  });

  it("shows every task not on Focus on Main, ADR 0015", () => {
    // Work and Errands have no tab yet, so they fall into Main rather
    // than vanishing. A task on both lists stays only on Focus.
    expect(names(selectTabTasks(tasks, "Main"))).toEqual([
      "Buy milk",
      "Call bank",
      "Errand",
    ]);
  });

  it("partitions the rows into two disjoint tabs", () => {
    const focus = selectTabTasks(tasks, "Focus");
    const main = selectTabTasks(tasks, "Main");
    const focusUris = new Set(focus.map((item) => item.uri));

    expect(main.some((item) => focusUris.has(item.uri))).toBe(false);
    expect([...focus, ...main]).toHaveLength(tasks.length);
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
