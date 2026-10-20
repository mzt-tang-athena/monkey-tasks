import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../features/tasks/query";
import { addDays, formatLocal, startOfDay } from "./dates";

/**
 * Mock tasks for the design exploration. The shape mirrors TaskItem
 * from the real model, so screens can swap to the vault later without
 * touching their rendering code. Dates are relative to today, so every
 * group (past, today, upcoming, no date, completed) stays populated.
 */

function mock(
  name: string,
  data: Partial<TaskFrontmatter>,
  body = "",
): TaskItem {
  const uri = `mock://vault/Tasks/${name}.md`;
  return {
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: {
      kind: "[[tasks]]",
      created: formatLocal(startOfDay(new Date()), false),
      ...data,
    },
    body,
  };
}

function dueOn(offsetDays: number, time?: { h: number; m: number }): string {
  const date = addDays(new Date(), offsetDays);
  if (time) {
    date.setHours(time.h, time.m, 0, 0);
  }
  return formatLocal(date, time != null);
}

export const mockLists = ["Focus", "Main"] as const;

/** The other real list, so the list tab bar has data behind it. */
export function inMockFocus(items: TaskItem[]): TaskItem[] {
  return items.filter((item) => item.data?.lists?.includes("[[Focus]]"));
}

export function inMockMain(items: TaskItem[]): TaskItem[] {
  return items.filter((item) => item.data == null || !item.data.lists?.length);
}

/** A tiny delay so loading and error states are real code paths. */
export function loadMockTasks(): Promise<TaskItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(buildTasks()), 120);
  });
}

/** Flip a mock task's completed date in place, for local toggling. */
export function toggleMockCompleted(item: TaskItem): TaskItem {
  const done = item.data?.completed != null && item.data.completed !== "";
  if (!item.data) {
    return item;
  }
  return {
    ...item,
    data: { ...item.data, completed: done ? null : isoToday() },
  };
}

function isoToday(): string {
  return formatLocal(startOfDay(new Date()), false);
}

function buildTasks(): TaskItem[] {
  return [
    // Past: overdue maintenance, the brief's example.
    mock("Water heater maintenance request", {
      due: dueOn(-3),
    }),
    mock("Return library books", {
      due: dueOn(-1),
    }),

    // Today: untimed and timed, including the recurring supplements.
    mock("Supplements", {
      due: dueOn(0, { h: 19, m: 0 }),
      recurrence: "RRULE:FREQ=DAILY",
    }),
    mock("Groceries: milk, eggs, oats", {
      due: dueOn(0),
    }),
    mock("Plan weekend hike", {
      lists: ["[[Focus]]"],
      due: dueOn(0),
    }),

    // Upcoming days.
    mock("Dentist appointment", {
      due: dueOn(1, { h: 14, m: 30 }),
    }),
    mock("Pay water bill", {
      due: dueOn(2),
    }),
    mock("Renew bike insurance", {
      due: dueOn(4),
    }),
    mock("Order printer paper", {
      lists: ["[[Focus]]"],
      due: dueOn(3),
    }),

    // No date.
    mock("Call Mum", {}),
    mock("Clear vault inbox", {
      lists: ["[[Focus]]"],
    }),

    // Completed, faded at the bottom.
    mock("Buy stamps", {
      completed: formatLocal(addDays(new Date(), 0), false),
    }),
    mock("Fix bike light", {
      completed: formatLocal(addDays(new Date(), -1), false),
    }),
  ];
}
