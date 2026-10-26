// Reproductions of audit finding 2, written before the fix (ticket
// 0052). Each `it.fails` asserts the behaviour we want, so it passes
// today only because the bug is still there. The fix turns it into a
// plain `it`.
//
// The store runs a full alarm rebuild on every cache change, and a
// per-task sync after each write. Nothing orders them, so two rebuilds,
// or a rebuild and a per-task sync, interleave and schedule one
// reminder twice. The phone then rings twice.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  syncReminders,
  syncTaskReminders,
} from "../../features/reminders/sync";
import type { TaskItem } from "../../features/tasks/query";

/** The OS alarm list: alarm id to task name. */
const alarms = new Map<string, string>();
let nextId = 0;

/** Every scheduler call yields once, like a native bridge call. */
function bridge(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
}

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

vi.mock("../../features/reminders/schedule", () => ({
  ensureNotificationPermission: async () => {
    await bridge();
    return true;
  },
  scheduleAt: async (_when: Date, title: string) => {
    await bridge();
    nextId += 1;
    const id = `alarm-${nextId}`;
    alarms.set(id, title);
    return id;
  },
  cancelAllScheduled: async () => {
    await bridge();
    alarms.clear();
  },
  cancelScheduled: async (id: string) => {
    await bridge();
    alarms.delete(id);
  },
}));

function task(name: string, open = true): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      reminders: ["2999-01-01T09:00"],
      ...(open ? {} : { completed: "2026-10-26" }),
    },
  };
}

beforeEach(() => {
  alarms.clear();
  nextId = 0;
});

describe("alarm sync races (ticket 0052)", () => {
  it.fails("schedules each reminder once when two rebuilds overlap", async () => {
    const tasks = ["A", "B", "C", "D"].map((name) => task(name));
    await Promise.all([syncReminders(tasks), syncReminders(tasks)]);
    expect(alarms.size).toBe(4);
  });

  it.fails("schedules a reopened task once when a rebuild overlaps", async () => {
    const before = [task("A"), task("B"), task("C"), task("D", false)];
    await syncReminders(before);
    expect(alarms.size).toBe(3);
    const reopened = task("D");
    const after = [...before.slice(0, 3), reopened];
    await Promise.all([
      syncReminders(after),
      syncTaskReminders(task("D", false), reopened),
    ]);
    expect([...alarms.values()].filter((name) => name === "D")).toHaveLength(1);
  });
});
