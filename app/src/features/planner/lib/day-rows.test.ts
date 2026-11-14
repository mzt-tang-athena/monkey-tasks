import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { dayRows, sortDay, tasksOnDay } from "./day-rows";

function task(name: string, data: Partial<TaskFrontmatter> = {}): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: { kind: "[[tasks]]", created: "2026-10-01", ...data },
  };
}

const names = (tasks: TaskItem[]) => tasks.map((item) => item.name);

// Monday 26 October 2026.
const today = new Date(2026, 9, 26);
const tomorrow = new Date(2026, 9, 27);

describe("sortDay", () => {
  it("puts all-day tasks first, then timed ones by time of day", () => {
    const sorted = sortDay([
      task("Evening", { due: "2026-10-27T19:00" }),
      task("Zebra", { due: "2026-10-27" }),
      task("Morning", { due: "2026-10-27T08:00" }),
      task("Apple", { due: "2026-10-27" }),
    ]);

    expect(names(sorted)).toEqual(["Apple", "Zebra", "Morning", "Evening"]);
  });

  it("keeps open tasks ahead of done ones", () => {
    const sorted = sortDay([
      task("Done early", { due: "2026-10-27T07:00", completed: "2026-10-27" }),
      task("Open late", { due: "2026-10-27T21:00" }),
    ]);

    expect(names(sorted)).toEqual(["Open late", "Done early"]);
  });

  it("sorts a recurrence by its own time, not the day it is stored on", () => {
    const supplements = task("Supplements", {
      due: "2026-10-26T19:00",
      recurrence: "FREQ=DAILY",
    });
    const dentist = task("Dentist", { due: "2026-10-27T14:30" });

    expect(names(sortDay([supplements, dentist]))).toEqual([
      "Dentist",
      "Supplements",
    ]);
  });
});

describe("tasksOnDay", () => {
  const supplements = task("Supplements", {
    due: "2026-10-26T19:00",
    recurrence: "FREQ=DAILY",
  });
  const dentist = task("Dentist", { due: "2026-10-27T14:30" });
  const weekly = task("Water plants", {
    due: "2026-10-20",
    recurrence: "FREQ=WEEKLY",
  });

  it("lists a recurrence that falls on a day other than today", () => {
    const rows = tasksOnDay([supplements, dentist, weekly], tomorrow, today);

    expect(names(rows)).toEqual(["Water plants", "Dentist", "Supplements"]);
  });

  it("lists only the notes stored on today", () => {
    const rows = tasksOnDay([supplements, dentist, weekly], today, today);

    expect(names(rows)).toEqual(["Supplements"]);
  });

  it("keeps a done task on its day", () => {
    const done = task("Filed", { due: "2026-10-27", completed: "2026-10-27" });

    expect(names(tasksOnDay([done], tomorrow, today))).toEqual(["Filed"]);
  });
});

describe("dayRows", () => {
  const overdue = task("Late", { due: "2026-10-24" });
  const dueToday = task("Due today", { due: "2026-10-26T10:00" });
  const focus = task("On focus", { list: "[[Focus]]" });
  const all = [overdue, dueToday, focus];
  const base = { tasks: all, day: today, today, source: "due-period" } as const;

  it("separates the overdue group on today only", () => {
    expect(names(dayRows({ ...base, taskForm: "rows" }).overdue)).toEqual(["Late"]);
    expect(dayRows({ ...base, day: tomorrow, taskForm: "rows" }).overdue).toEqual([]);
  });

  it("pins the timed tasks to the ruler", () => {
    expect(names(dayRows({ ...base, taskForm: "rows" }).timed)).toEqual(["Due today"]);
  });

  it("lists the day's tasks in the rows form", () => {
    expect(names(dayRows({ ...base, taskForm: "rows" }).sectionTasks)).toEqual([
      "Due today",
    ]);
  });

  it("folds the overdue group into the pills pool", () => {
    expect(names(dayRows({ ...base, taskForm: "pills" }).sectionTasks)).toEqual([
      "Late",
      "Due today",
    ]);
  });

  it("sorts a recurrence by its own time in the pills form", () => {
    const supplements = task("Supplements", {
      due: "2026-10-26T19:00",
      recurrence: "FREQ=DAILY",
    });
    const dentist = task("Dentist", { due: "2026-10-27T14:30" });
    const rows = dayRows({
      tasks: [supplements, dentist],
      day: tomorrow,
      today,
      source: "due-period",
      taskForm: "pills",
    });

    expect(names(rows.sectionTasks)).toEqual(["Dentist", "Supplements"]);
  });

  it("lists a named list's tasks instead of the day's", () => {
    const rows = dayRows({ ...base, source: "Focus", taskForm: "rows" });

    expect(names(rows.sectionTasks)).toEqual(["On focus"]);
  });
});
