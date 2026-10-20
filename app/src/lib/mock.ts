import * as React from "react";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { todayIso } from "./dates";
import type { TaskItem } from "../features/tasks/query";
import type { ParsedCapture } from "../features/capture/parse";

/**
 * Mock vault for the design exploration branch. Task items are
 * shaped exactly like the real model, so the screens render on web
 * without a granted vault folder.
 */

const pad = (n: number) => String(n).padStart(2, "0");

function isoDay(offsetDays: number): string {
  const now = new Date();
  const day = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
  );
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

function isoDayTime(offsetDays: number, time: string): string {
  return `${isoDay(offsetDays)}T${time}`;
}

function task(name: string, data: TaskFrontmatter): TaskItem {
  return {
    uri: `mock://tasks/${name}.md`,
    fileName: `${name}.md`,
    name,
    text: "",
    data,
    body: "",
  };
}

export const mockTasks: TaskItem[] = [
  // Main, overdue.
  task("Send maintenance request", {
    kind: "[[tasks]]",
    created: isoDay(-30),
    due: isoDay(-2),
  }),
  task("Call plumber about leak", {
    kind: "[[tasks]]",
    created: isoDay(-6),
    due: isoDayTime(-1, "14:00"),
  }),
  // Main, today.
  task("Take supplements", {
    kind: "[[tasks]]",
    created: isoDay(-90),
    due: isoDayTime(0, "19:00"),
    recurrence: "FREQ=DAILY",
  }),
  task("Buy groceries", {
    kind: "[[tasks]]",
    created: isoDay(-2),
    due: isoDayTime(0, "17:30"),
  }),
  task("Water the plants", {
    kind: "[[tasks]]",
    created: isoDay(-3),
    due: isoDay(0),
  }),
  // Focus list.
  task("Read refactoring chapter", {
    kind: "[[tasks]]",
    created: isoDay(-5),
    due: isoDayTime(0, "21:00"),
    lists: ["[[Focus]]"],
  }),
  task("Plan the week", {
    kind: "[[tasks]]",
    created: isoDay(-4),
    due: isoDay(1),
    lists: ["[[Focus]]"],
  }),
  // Upcoming.
  task("Book dentist appointment", {
    kind: "[[tasks]]",
    created: isoDay(-20),
    due: isoDay(3),
  }),
  task("Pick up prescription", {
    kind: "[[tasks]]",
    created: isoDay(-1),
    due: isoDayTime(1, "09:00"),
  }),
  // No date.
  task("Back up photos", {
    kind: "[[tasks]]",
    created: isoDay(-14),
  }),
  // Completed.
  task("Pay electricity bill", {
    kind: "[[tasks]]",
    created: isoDay(-25),
    due: isoDay(-1),
    completed: isoDay(-1),
  }),
  task("Sort the mail", {
    kind: "[[tasks]]",
    created: isoDay(-8),
    completed: isoDay(0),
  }),
];

export type MockVault = {
  tasks: TaskItem[];
  loading: boolean;
  error: string | null;
  toggle: (task: TaskItem) => void;
  capture: (parsed: ParsedCapture, listName: string | null) => void;
};

/**
 * Mock-driven stand-in for the vault session. Toggle and capture
 * mutate local state, so pressed, disabled and empty states can be
 * exercised for real.
 */
export function useMockTasks(): MockVault {
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setTasks(mockTasks);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const toggle = React.useCallback((target: TaskItem) => {
    setTasks((current) =>
      current.map((item) => {
        if (item.uri !== target.uri || !item.data) {
          return item;
        }
        const isDone = item.data.completed != null && item.data.completed !== "";
        return {
          ...item,
          data: {
            ...item.data,
            completed: isDone ? null : todayIso(),
          },
        };
      }),
    );
  }, []);

  const capture = React.useCallback(
    (parsed: ParsedCapture, listName: string | null) => {
      if (!parsed.name) {
        return;
      }
      const data: TaskFrontmatter = { kind: "[[tasks]]", created: todayIso() };
      if (parsed.due) {
        data.due = parsed.due;
      }
      if (parsed.recurrence) {
        data.recurrence = parsed.recurrence;
      }
      if (parsed.reminders?.length) {
        data.reminders = [...parsed.reminders];
      }
      if (listName) {
        data.lists = [`[[${listName}]]`];
      }
      setTasks((current) => [task(parsed.name, data), ...current]);
    },
    [],
  );

  return { tasks, loading, error, toggle, capture };
}
