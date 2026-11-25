import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import {
  blockerOf,
  foldBoard,
  linkName,
  notesByName,
  selectBoardSections,
  selectDeeds,
  statusWrite,
} from "./board";

function item(
  name: string,
  data: Partial<TaskFrontmatter> = {},
  extra: Partial<TaskItem> = {},
): TaskItem {
  return {
    id: name,
    uri: `vault:${name}`,
    fileName: `${name}.md`,
    name,
    text: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      "alert weight": "harsh",
      ...data,
    },
    body: "",
    ...extra,
  };
}

const deeds = [
  item("Water", { status: "[[active]]", order: 2 }),
  item("Ship", { status: "[[active]]", order: 1 }),
  item("Plan", { status: "[[backlog]]" }),
  item("Learn", { status: "[[someday]]" }),
  item("Win", { status: "[[done]]", completed: "2026-10-20" }),
  item("Idea", { status: "[[dropped]]" }),
  item("Plain"),
];

describe("selectDeeds", () => {
  it("keeps the tasks with a status and drops the plain ones", () => {
    expect(selectDeeds(deeds).map((task) => task.name)).toEqual([
      "Water",
      "Ship",
      "Plan",
      "Learn",
      "Win",
      "Idea",
    ]);
  });
});

describe("selectBoardSections", () => {
  it("always draws the five groups, in the accepted order", () => {
    expect(selectBoardSections([]).map((section) => section.title)).toEqual([
      "Active",
      "Backlog",
      "Someday",
      "Done",
      "Dropped",
    ]);
  });

  it("sorts the open groups by order, then created, then name", () => {
    const sections = selectBoardSections(deeds);
    expect(sections[0].data.map((task) => task.name)).toEqual(["Ship", "Water"]);
  });

  it("puts a due date first, undated last, and never reorders by hand", () => {
    const dated = [
      item("Later", { status: "[[active]]", due: "2026-10-30", order: 1 }),
      item("Sooner", { status: "[[active]]", due: "2026-10-27", order: 2 }),
      item("Undated", { status: "[[active]]", order: 0 }),
    ];
    const sections = selectBoardSections(dated, "due");
    expect(sections[0].data.map((task) => task.name)).toEqual([
      "Sooner",
      "Later",
      "Undated",
    ]);
  });

  it("folds Done and Dropped by name", () => {
    const extra = [
      item("B done", { status: "[[done]]", completed: "2026-10-20" }),
      item("A done", { status: "[[done]]", completed: "2026-10-20" }),
    ];
    const done = selectBoardSections(extra)[3];
    expect(done.data.map((task) => task.name)).toEqual(["A done", "B done"]);
  });
});

describe("foldBoard", () => {
  it("hides only the folded rows and keeps every header", () => {
    const sections = selectBoardSections(deeds);
    const folded = foldBoard(sections, (group) => group === "done");
    expect(folded.map((section) => section.title)).toEqual([
      "Active",
      "Backlog",
      "Someday",
      "Done",
      "Dropped",
    ]);
    expect(folded[3].data.map((task) => task.name)).toEqual(["Win"]);
    expect(folded[4].data).toEqual([]);
    expect(folded[0].data).toHaveLength(2);
  });
});

describe("blockerOf", () => {
  const byName = () =>
    notesByName([
      item("Ship the design", { status: "[[active]]" }),
      item("Write the ADR", { status: "[[done]]", completed: "2026-10-20" }),
    ]);

  it("names the first linked note that is not done", () => {
    const task = item("Build", { "blocked by": ["[[Ship the design]]"] });
    expect(blockerOf(task, byName())).toBe("Ship the design");
  });

  it("reads a done link as ready", () => {
    const task = item("Build", { "blocked by": ["[[Write the ADR]]"] });
    expect(blockerOf(task, byName())).toBeNull();
  });

  it("does not block on a link that reaches no note", () => {
    const task = item("Build", { "blocked by": ["[[Gone note]]"] });
    expect(blockerOf(task, byName())).toBeNull();
  });

  it("reads an alias, a heading and a folder path", () => {
    const task = item("Build", {
      "blocked by": ["[[Tasks/Ship the design#Plan|the design]]"],
    });
    expect(linkName("[[Tasks/Ship the design#Plan|the design]]")).toBe(
      "Ship the design",
    );
    expect(blockerOf(task, byName())).toBe("Ship the design");
  });
});

describe("statusWrite", () => {
  const now = "2026-10-26T09:00";

  it("writes Done with a completed date", () => {
    expect(statusWrite(item("Build"), "done", now)).toEqual({
      status: "[[done]]",
      completed: now,
    });
  });

  it("keeps the completed date a done deed already holds", () => {
    const deed = item("Build", {
      status: "[[done]]",
      completed: "2026-10-20",
    });
    expect(statusWrite(deed, "done", now).completed).toBe("2026-10-20");
  });

  it("leaves Done by dropping the completed date", () => {
    const deed = item("Build", {
      status: "[[done]]",
      completed: "2026-10-20",
    });
    expect(statusWrite(deed, "backlog", now)).toEqual({
      status: "[[backlog]]",
      completed: null,
    });
  });
});
