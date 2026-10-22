import { describe, expect, it, vi, beforeEach } from "vitest";

// The scheduler talks to the OS; the store calls it fire-and-forget. The
// test pins the rule that matters: a successful vault read rebuilds the
// alarm list, so a completed or deleted task cannot leave an alarm
// behind, and a denied permission prompt cannot wipe the list.

const scheduled: { when: Date; title: string }[] = [];
let permission = true;
let cancelled = 0;
let failNext = false;

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("./schedule", () => ({
  ensureNotificationPermission: async () => permission,
  cancelAllScheduled: async () => {
    cancelled += 1;
  },
  scheduleAt: async (when: Date, title: string) => {
    if (failNext) {
      failNext = false;
      throw new Error("no channel");
    }
    scheduled.push({ when, title });
    return `id-${scheduled.length}`;
  },
}));

import { syncReminders } from "./sync";
import type { TaskItem } from "../tasks/query";

function task(
  name: string,
  reminders: string[],
  completed?: string,
): TaskItem {
  return {
    uri: `content://vault/Tasks/${name}.md`,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      reminders,
      ...(completed ? { completed } : {}),
    },
  };
}

const future = "2999-01-01T09:00";
const past = "2000-01-01T09:00";

beforeEach(() => {
  scheduled.length = 0;
  cancelled = 0;
  permission = true;
  failNext = false;
});

describe("syncReminders", () => {
  it("schedules one alarm per future reminder on an open task", async () => {
    const result = await syncReminders([task("Call Mum", [future])]);
    expect(result).toEqual({ scheduled: 1, skipped: false });
    expect(cancelled).toBe(1);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].title).toBe("Call Mum");
  });

  it("cancels a completed task's alarm instead of leaving it ringing", async () => {
    const result = await syncReminders([
      task("Done thing", [future], "2026-10-21"),
    ]);
    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(cancelled).toBe(1);
    expect(scheduled).toHaveLength(0);
  });

  it("ignores reminders that are already in the past", async () => {
    const result = await syncReminders([task("Old", [past])]);
    expect(result.scheduled).toBe(0);
    expect(scheduled).toHaveLength(0);
  });

  it("does not cancel anything when permission is denied", async () => {
    permission = false;
    const result = await syncReminders([task("Call Mum", [future])]);
    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(cancelled).toBe(0);
  });

  it("never throws when the scheduler does", async () => {
    failNext = true;
    const result = await syncReminders([task("Call Mum", [future])]);
    expect(result.skipped).toBe(true);
  });
});
