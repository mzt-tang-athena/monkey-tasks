import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../features/tasks/query";
import type { ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import { addDays, formatLocal, todayIso } from "./dates";

/**
 * Mock task data for the design branch. Shaped exactly like the real
 * model (TaskItem with TaskFrontmatter) so the screens and components
 * render against the same types the vault feed will produce.
 *
 * Dates are built relative to "now", so every group (past, today,
 * upcoming, no date, completed) stays populated on any day.
 */

/** Real list names, Main first. */
export const mockLists = ["Main", "Focus"] as const;

type MockSpec = {
  id: string;
  name: string;
  due?: string;
  completed?: string;
  reminders?: string[];
  recurrence?: string;
  lists?: string[];
};

/** Date string offsetDays days from today, optionally with a time. */
function dueString(
  offsetDays: number,
  time?: { hour: number; minute: number },
): string {
  const date = addDays(new Date(), offsetDays);
  if (time) {
    date.setHours(time.hour, time.minute, 0, 0);
    return formatLocal(date, true);
  }
  return formatLocal(date, false);
}

function toItem(spec: MockSpec): TaskItem {
  const data: TaskFrontmatter = {
    kind: "[[tasks]]",
    created: todayIso(),
  };
  if (spec.due) {
    data.due = spec.due;
  }
  if (spec.completed) {
    data.completed = spec.completed;
  }
  if (spec.reminders) {
    data.reminders = spec.reminders;
  }
  if (spec.recurrence) {
    data.recurrence = spec.recurrence;
  }
  if (spec.lists) {
    data.lists = spec.lists;
  }
  return {
    uri: `mock://${spec.id}`,
    fileName: `${spec.name}.md`,
    name: spec.name,
    text: "",
    data,
    body: "",
  };
}

export const mockTasks: TaskItem[] = [
  // Past
  toItem({
    id: "t01",
    name: "Text the landlord about the kitchen faucet",
    due: dueString(-4, { hour: 12, minute: 0 }),
  }),
  toItem({
    id: "t02",
    name: "Pay the water bill",
    due: dueString(-2),
  }),
  // Today, timed
  toItem({
    id: "t03",
    name: "Take evening supplements",
    due: dueString(0, { hour: 19, minute: 0 }),
    recurrence: "FREQ=DAILY",
    reminders: [dueString(0, { hour: 19, minute: 0 })],
  }),
  toItem({
    id: "t04",
    name: "Collect the parcel from the corner shop",
    due: dueString(0, { hour: 17, minute: 30 }),
  }),
  // Today, untimed
  toItem({
    id: "t05",
    name: "Water the plants",
    due: dueString(0),
  }),
  // Focus list
  toItem({
    id: "t06",
    name: "Read two pages of the current book",
    due: dueString(0),
    lists: ["[[Focus]]"],
  }),
  toItem({
    id: "t07",
    name: "Draft the dentist appointment questions",
    lists: ["[[Focus]]"],
  }),
  // Upcoming
  toItem({
    id: "t08",
    name: "Buy groceries: oat milk, eggs, spinach",
    due: dueString(1),
  }),
  toItem({
    id: "t09",
    name: "Book the car service",
    due: dueString(3),
  }),
  toItem({
    id: "t10",
    name: "Prep questions for the dentist visit",
    due: dueString(5),
  }),
  // No date
  toItem({
    id: "t11",
    name: "Look into standing desk options",
  }),
  // Completed
  toItem({
    id: "t12",
    name: "Pick up the prescription",
    completed: dueString(-1),
  }),
  toItem({
    id: "t13",
    name: "Renew the library card",
    completed: dueString(-2),
  }),
];

/** Build a mock TaskItem from a parsed capture, mirroring writeCapture. */
export function taskFromCapture(
  parsed: ParsedCapture,
  target: CaptureTarget,
  preselectedDue?: string,
): TaskItem {
  const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
  const lists =
    target.kind === "list" ? [`[[${target.name}]]`] : undefined;
  return toItem({
    id: `new-${Date.now()}`,
    name: parsed.name,
    due,
    reminders: parsed.reminders,
    recurrence: parsed.recurrence,
    lists,
  });
}

/** Open (not completed) task count for one list, Main included. */
export function countOpen(tasks: TaskItem[], listName: string): number {
  return tasks.filter((task) => {
    if (task.data?.completed) {
      return false;
    }
    return listName === "Main"
      ? task.data == null || !task.data.lists?.length
      : task.data?.lists?.includes(`[[${listName}]]`) ?? false;
  }).length;
}
