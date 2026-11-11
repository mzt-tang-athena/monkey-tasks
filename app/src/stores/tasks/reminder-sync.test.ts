import { describe, expect, it, vi, beforeEach } from "vitest";

// The scheduler talks to the OS; the store calls it fire-and-forget. The
// test pins the rule that matters: a successful vault read rebuilds the
// alarm list, so a completed or deleted task cannot leave an alarm
// behind, and a denied permission prompt cannot wipe the list.

const scheduled: { when: Date; title: string; body: string }[] = [];
let permission = true;
let cancelled = 0;
let cancelledIds: string[] = [];
let failNext = false;

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: async () => permission,
  cancelAllScheduled: async () => {
    cancelled += 1;
  },
  cancelScheduled: async (id: string) => {
    cancelledIds.push(id);
  },
  scheduleAt: async (when: Date, title: string, body: string) => {
    if (failNext) {
      failNext = false;
      throw new Error("no channel");
    }
    scheduled.push({ when, title, body });
    return `id-${scheduled.length}`;
  },
}));

import { syncReminders, syncTaskReminders } from "./reminder-sync";
import type { TaskItem } from "@/types/task";

function task(
  name: string,
  reminders: string[],
  completed?: string,
  due?: string,
): TaskItem {
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
      reminders,
      ...(due != null ? { due } : {}),
      ...(completed ? { completed } : {}),
    },
  };
}

const future = "2999-01-01T09:00";
const past = "2000-01-01T09:00";

beforeEach(() => {
  scheduled.length = 0;
  cancelled = 0;
  cancelledIds = [];
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

describe("syncTaskReminders", () => {
  it("cancels only the ticked task's alarms", async () => {
    const call = task("Call Mum", [future]);
    const post = task("Post letter", [future]);
    await syncReminders([call, post]);
    expect(scheduled).toHaveLength(2);
    scheduled.length = 0;

    // Ticking removes the reminders from the note.
    const ticked: TaskItem = {
      ...call,
      data: { ...call.data!, completed: "2026-10-22", reminders: undefined },
    };
    await syncTaskReminders(call, ticked);

    // One id cancelled, and it is the first task's.
    expect(cancelledIds).toEqual(["id-1"]);
    // The full rebuild did not run, so the other task kept its alarm.
    expect(cancelled).toBe(1);
    expect(scheduled).toHaveLength(0);
  });

  it("does nothing when the reminders did not move", async () => {
    const call = task("Call Mum", [future]);
    await syncReminders([call]);
    const renamed: TaskItem = { ...call, name: "Call Mum back" };
    await syncTaskReminders(call, renamed);
    expect(cancelledIds).toEqual([]);
    expect(scheduled).toHaveLength(1);
  });

  it("schedules a captured task's first alarm", async () => {
    const captured = task("Call Mum", [future]);
    await syncTaskReminders(null, captured);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].title).toBe("Call Mum");
  });

  it("never throws when the scheduler does", async () => {
    failNext = true;
    await expect(
      syncTaskReminders(null, task("Call Mum", [future])),
    ).resolves.toBeUndefined();
  });
});

function at(iso: string): number {
  const [date, time] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

describe("a timed due rings", () => {
  it("schedules one alarm at the due time and says it is due", async () => {
    const result = await syncReminders([task("Pay rent", [], undefined, future)]);
    expect(result).toEqual({ scheduled: 1, skipped: false });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].when.getTime()).toBe(at(future));
    expect(scheduled[0].title).toBe("Pay rent");
    expect(scheduled[0].body).toBe("Due");
  });

  it("leaves a date-only due silent", async () => {
    const result = await syncReminders([
      task("Pay rent", [], undefined, "2999-01-01"),
    ]);
    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(scheduled).toHaveLength(0);
  });

  it("rings once when a reminder repeats the due minute", async () => {
    await syncReminders([
      task("Pay rent", [future], undefined, future),
    ]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].body).toBe("Due");
  });

  it("rings a later reminder after the due, in time order", async () => {
    const later = "2999-01-01T10:30";
    await syncReminders([
      task("Pay rent", [later], undefined, future),
    ]);
    expect(scheduled.map((alarm) => alarm.when.getTime())).toEqual([
      at(future),
      at(later),
    ]);
    expect(scheduled.map((alarm) => alarm.body)).toEqual([
      "Due",
      "Task reminder",
    ]);
  });

  it("rings a reminder on a date-only due", async () => {
    await syncReminders([
      task("Pay rent", [future], undefined, "2999-01-01"),
    ]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].body).toBe("Task reminder");
  });

  it("stays silent on a completed task and cancels its due alarm on a tick", async () => {
    const open = task("Pay rent", [], undefined, future);
    await syncReminders([open]);
    expect(scheduled).toHaveLength(1);

    const ticked: TaskItem = {
      ...open,
      data: { ...open.data!, completed: "2026-11-11" },
    };
    await syncTaskReminders(open, ticked);
    expect(cancelledIds).toEqual(["id-1"]);

    scheduled.length = 0;
    const result = await syncReminders([ticked]);
    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(scheduled).toHaveLength(0);
  });

  it("reschedules the due alarm when an edit moves it", async () => {
    const before = task("Pay rent", [], undefined, future);
    await syncReminders([before]);
    scheduled.length = 0;

    const moved = "2999-01-01T11:00";
    const after = task("Pay rent", [], undefined, moved);
    await syncTaskReminders(before, after);

    expect(cancelledIds).toEqual(["id-1"]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].when.getTime()).toBe(at(moved));
    expect(scheduled[0].body).toBe("Due");
  });

  it("schedules nothing and writes no note when permission is denied", async () => {
    permission = false;
    const note = task("Pay rent", [], undefined, future);
    const text = note.text;
    const result = await syncReminders([note]);

    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(scheduled).toHaveLength(0);
    expect(cancelled).toBe(0);
    expect(note.text).toBe(text);
    expect(note.data?.due).toBe(future);
  });

  it("schedules nothing for a past due", async () => {
    const result = await syncReminders([
      task("Pay rent", [], undefined, past),
    ]);
    expect(result.scheduled).toBe(0);
    expect(scheduled).toHaveLength(0);
  });
});
