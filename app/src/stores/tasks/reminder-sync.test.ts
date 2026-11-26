import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The scheduler talks to the OS; the store calls it fire-and-forget.
// These tests pin the plan: which rings a note wants, and which
// scheduled rings a rebuild keeps, cancels, or never arms again.

type Stored = {
  id: string;
  when: number;
  title: string;
  body: string;
  weight: "harsh" | "quiet";
  data: {
    uri: string;
    base: number;
    weight: "harsh" | "quiet";
    buttons: "full" | "done";
  };
};

const world = vi.hoisted(() => ({
  os: new Map<string, Stored>(),
  delivered: new Map<string, Stored>(),
  cancelled: [] as string[],
  dismissed: [] as string[],
  permission: true,
  failNext: false,
  acked: {} as Record<string, number>,
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: async () => world.permission,
  ensureChannels: async () => undefined,
  scheduleRing: async (ring: {
    id: string;
    uri: string;
    base: number;
    weight: "harsh" | "quiet";
    when: number;
    buttons: "full" | "done";
    title: string;
    body: string;
  }) => {
    if (world.failNext) {
      world.failNext = false;
      throw new Error("no channel");
    }
    world.os.set(ring.id, {
      id: ring.id,
      when: ring.when,
      title: ring.title,
      body: ring.body,
      weight: ring.weight,
      data: {
        uri: ring.uri,
        base: ring.base,
        weight: ring.weight,
        buttons: ring.buttons,
      },
    });
    return ring.id;
  },
  cancelScheduled: async (id: string) => {
    world.cancelled.push(id);
    world.os.delete(id);
  },
  listScheduledDetailed: async () =>
    [...world.os.values()].map(({ id, data }) => ({ id, data })),
  listDeliveredDetailed: async () =>
    [...world.delivered.values()].map(({ id, data }) => ({ id, data })),
  dismissDelivered: async (ids: string[]) => {
    for (const id of ids) {
      world.dismissed.push(id);
      world.delivered.delete(id);
    }
  },
}));

vi.mock("@/lib/alerts/acked", () => ({
  loadAcked: () => ({ ...world.acked }),
  isAcked: (acked: Record<string, number>, uri: string, base: number) =>
    acked[`${uri}|${base}`] != null,
  recordAcks: (groups: { uri: string; base: number }[], now: number) => {
    for (const group of groups) {
      world.acked[`${group.uri}|${group.base}`] = now;
    }
  },
}));

import {
  acknowledgeRing,
  syncReminders,
  syncTaskReminders,
} from "./reminder-sync";
import { alertRingId } from "@/lib/alerts/rings";
import type { TaskItem } from "@/types/task";

const NOW = new Date(2026, 10, 16, 9, 0).getTime();
const MINUTE = 60_000;

/** A local minute stamp, the shape a note stores. */
function stamp(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function task(
  name: string,
  reminders: string[],
  options: {
    due?: string;
    completed?: string;
    weight?: "harsh" | "quiet";
  } = {},
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
      "alert weight": options.weight ?? "quiet",
      reminders,
      ...(options.due != null ? { due: options.due } : {}),
      ...(options.completed != null ? { completed: options.completed } : {}),
    },
  };
}

function id(uri: string, base: number): string {
  return alertRingId(uri, base);
}

function basesOf(uri: string): number[] {
  return [...world.os.values()]
    .filter((entry) => entry.data.uri === uri)
    .map((entry) => entry.data.base)
    .sort((a, b) => a - b);
}

/** The OS delivered this ring: it leaves the schedule for the tray. */
function deliver(id: string): void {
  const entry = world.os.get(id);
  if (entry == null) {
    throw new Error(`not scheduled: ${id}`);
  }
  world.os.delete(id);
  world.delivered.set(id, entry);
}

beforeEach(() => {
  world.os.clear();
  world.delivered.clear();
  world.cancelled.length = 0;
  world.dismissed.length = 0;
  world.permission = true;
  world.failNext = false;
  world.acked = {};
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ring plan", () => {
  it("makes one ring when a due and a reminder share a minute", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Pay rent", [stamp(base)], { due: stamp(base) });

    await syncReminders([note]);

    const entries = [...world.os.values()];
    expect(entries.map((entry) => entry.data.base)).toEqual([base]);
    expect(entries.map((entry) => entry.body)).toEqual(["Due"]);
  });

  it("gives an all-day task Done alone, and its reminder still rings", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Pay rent", [stamp(base)], { due: "2026-11-25" });

    await syncReminders([note]);

    const entries = [...world.os.values()];
    expect(entries).toHaveLength(1);
    expect(entries[0].data.buttons).toBe("done");
  });

  it("gives a timed task Done and Reschedule", async () => {
    const note = task("Call Mum", [stamp(NOW + 10 * MINUTE)], {
      due: stamp(NOW + 10 * MINUTE),
    });

    await syncReminders([note]);

    expect(
      [...world.os.values()].every((entry) => entry.data.buttons === "full"),
    ).toBe(true);
  });

  it("replaces a scheduled ring that has no buttons", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);
    await syncReminders([note]);
    for (const entry of world.os.values()) {
      entry.data.buttons = "done";
    }

    await syncReminders([note]);

    expect(basesOf(note.uri)).toEqual([base]);
    expect(world.cancelled).toEqual([id(note.uri, base)]);
    expect(
      [...world.os.values()].every((entry) => entry.data.buttons === "full"),
    ).toBe(true);
  });

  it("makes one ring for a normal reminder, and never a repeat", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);

    await syncReminders([note]);

    const entries = [...world.os.values()];
    expect(entries).toHaveLength(1);
    expect(entries[0].when).toBe(base);
    expect(entries[0].weight).toBe("quiet");
  });

  it("makes one ring for an alarm, and never a repeat", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Take the pill", [stamp(base)], { weight: "harsh" });

    await syncReminders([note]);

    const entries = [...world.os.values()];
    expect(entries).toHaveLength(1);
    expect(entries[0].when).toBe(base);
    expect(entries[0].weight).toBe("harsh");
  });

  it("reads a note with no weight as a normal reminder", async () => {
    const note = task("Call Mum", [stamp(NOW + 10 * MINUTE)]);
    delete (note.data as Record<string, unknown>)["alert weight"];

    await syncReminders([note]);

    expect([...world.os.values()][0].weight).toBe("quiet");
  });

  it("ignores reminders that are already in the past", async () => {
    await syncReminders([task("Old", [stamp(NOW - 60 * MINUTE)])]);
    expect(world.os.size).toBe(0);
  });

  it("leaves a date-only due silent", async () => {
    await syncReminders([
      task("Pay rent", [], { due: "2999-01-01" }),
    ]);
    expect(world.os.size).toBe(0);
  });

  it("schedules nothing for a past due", async () => {
    const result = await syncReminders([
      task("Pay rent", [], { due: stamp(NOW - 60 * MINUTE) }),
    ]);
    expect(result.scheduled).toBe(0);
    expect(world.os.size).toBe(0);
  });

  it("rings a later reminder after the due, in time order", async () => {
    const due = NOW + 10 * MINUTE;
    const later = NOW + 40 * MINUTE;
    await syncReminders([
      task("Pay rent", [stamp(later)], { due: stamp(due) }),
    ]);

    const entries = [...world.os.values()];
    expect(entries.map((entry) => entry.when)).toEqual([due, later]);
    expect(entries.map((entry) => entry.body)).toEqual([
      "Due",
      "Task reminder",
    ]);
  });

  it("rings a reminder on a date-only due", async () => {
    await syncReminders([
      task("Pay rent", [stamp(NOW + 10 * MINUTE)], { due: "2999-01-01" }),
    ]);
    expect(world.os.size).toBe(1);
    expect([...world.os.values()][0].body).toBe("Task reminder");
  });
});

describe("rebuild", () => {
  it("never re-arms a delivered ring", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);
    await syncReminders([note]);
    deliver(id(note.uri, base));

    vi.setSystemTime(base + 2 * MINUTE);
    const result = await syncReminders([note]);

    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(world.cancelled).toEqual([]);
    expect(world.os.size).toBe(0);
    expect(world.delivered.has(id(note.uri, base))).toBe(true);
  });

  it("drops a ring an older build scheduled, and arms the new one", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);
    const old = `${id(note.uri, base)}:5`;
    world.os.set(old, {
      id: old,
      when: base + 5 * MINUTE,
      title: "Call Mum",
      body: "Task reminder",
      weight: "harsh",
      data: { uri: note.uri, base, weight: "harsh", buttons: "full" },
    });

    await syncReminders([note]);

    expect(world.cancelled).toEqual([old]);
    expect([...world.os.keys()]).toEqual([id(note.uri, base)]);
  });

  it("does not re-arm an acknowledged ring", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);
    await syncReminders([note]);

    await acknowledgeRing({ uri: note.uri, base });
    expect(world.os.size).toBe(0);
    expect(world.cancelled).toEqual([id(note.uri, base)]);

    await syncReminders([note]);
    expect(world.os.size).toBe(0);
  });

  it("re-arms a ring on the other channel when the weight changes", async () => {
    const base = NOW + 10 * MINUTE;
    const normal = task("Call Mum", [stamp(base)]);
    await syncReminders([normal]);

    const alarm = task("Call Mum", [stamp(base)], { weight: "harsh" });
    await syncReminders([alarm]);

    expect(world.cancelled).toEqual([id(normal.uri, base)]);
    expect(world.os.get(id(alarm.uri, base))?.weight).toBe("harsh");
  });

  it("moves a due ring when the due changes", async () => {
    const first = NOW + 10 * MINUTE;
    const moved = first + 30 * MINUTE;
    const before = task("Pay rent", [], { due: stamp(first) });
    await syncReminders([before]);

    const after = task("Pay rent", [], { due: stamp(moved) });
    await syncReminders([after]);

    expect(world.cancelled).toEqual([id(before.uri, first)]);
    expect(basesOf(after.uri)).toEqual([moved]);
  });

  it("cancels a removed reminder's ring and keeps the other", async () => {
    const first = NOW + 10 * MINUTE;
    const kept = first + 20 * MINUTE;
    const before = task("Call Mum", [stamp(first), stamp(kept)]);
    await syncReminders([before]);

    const after = task("Call Mum", [stamp(kept)]);
    await syncReminders([after]);

    expect(world.cancelled).toEqual([id(before.uri, first)]);
    expect(basesOf(after.uri)).toEqual([kept]);
  });

  it("cancels a done task's ring", async () => {
    const base = NOW + 10 * MINUTE;
    const open = task("Call Mum", [stamp(base)]);
    await syncReminders([open]);

    const done = task("Call Mum", [stamp(base)], {
      completed: stamp(NOW),
    });
    await syncReminders([done]);

    expect(world.os.size).toBe(0);
    expect(world.cancelled).toEqual([id(open.uri, base)]);
  });

  it("does not cancel anything when permission is denied", async () => {
    world.permission = false;
    const result = await syncReminders([
      task("Call Mum", [stamp(NOW + 10 * MINUTE)]),
    ]);
    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(world.cancelled).toEqual([]);
  });

  it("never throws when the scheduler does", async () => {
    world.failNext = true;
    const result = await syncReminders([
      task("Call Mum", [stamp(NOW + 10 * MINUTE)]),
    ]);
    expect(result.skipped).toBe(true);
  });
});

describe("one task", () => {
  it("a tick clears only that task's ring and its tray entry", async () => {
    const base = NOW + 10 * MINUTE;
    const call = task("Call Mum", [stamp(base), stamp(base + 30 * MINUTE)]);
    const post = task("Post letter", [stamp(base)]);
    await syncReminders([call, post]);
    deliver(id(call.uri, base));

    const ticked = task("Call Mum", [], { completed: stamp(NOW) });
    await syncTaskReminders(call, ticked);

    expect(world.cancelled).toEqual([id(call.uri, base + 30 * MINUTE)]);
    expect(world.dismissed).toEqual([id(call.uri, base)]);
    expect(basesOf(post.uri)).toEqual([base]);
  });

  it("clears an alarm's tray entry on a tick", async () => {
    const base = NOW + 10 * MINUTE;
    const alarm = task("Take the pill", [stamp(base)], { weight: "harsh" });
    await syncReminders([alarm]);
    deliver(id(alarm.uri, base));

    await syncTaskReminders(
      alarm,
      task("Take the pill", [], { weight: "harsh", completed: stamp(NOW) }),
    );

    expect(world.dismissed).toEqual([id(alarm.uri, base)]);
    expect(world.os.size).toBe(0);
  });

  it("moves a reminder: the old ring goes, the new one is scheduled", async () => {
    const first = NOW + 10 * MINUTE;
    const second = NOW + 40 * MINUTE;
    const before = task("Call Mum", [stamp(first)]);
    await syncReminders([before]);

    const after = task("Call Mum", [stamp(second)]);
    await syncTaskReminders(before, after);

    expect(world.cancelled).toEqual([id(before.uri, first)]);
    expect(basesOf(before.uri)).toEqual([second]);
  });

  it("does nothing when the reminders did not move", async () => {
    const base = NOW + 10 * MINUTE;
    const call = task("Call Mum", [stamp(base)]);
    await syncReminders([call]);

    await syncTaskReminders(call, { ...call, name: "Call Mum back" });

    expect(world.cancelled).toEqual([]);
    expect(world.os.size).toBe(1);
  });

  it("reschedules the due ring when an edit moves it", async () => {
    const first = NOW + 10 * MINUTE;
    const second = NOW + 20 * MINUTE;
    const before = task("Pay rent", [], { due: stamp(first) });
    await syncReminders([before]);

    const after = task("Pay rent", [], { due: stamp(second) });
    await syncTaskReminders(before, after);

    expect(world.cancelled).toEqual([id(before.uri, first)]);
    expect(basesOf(before.uri)).toEqual([second]);
  });

  it("schedules a captured task's ring", async () => {
    const base = NOW + 10 * MINUTE;
    const captured = task("Call Mum", [stamp(base)]);
    await syncTaskReminders(null, captured);
    expect(world.os.size).toBe(1);
    expect([...world.os.values()][0].title).toBe("Call Mum");
  });

  it("stays silent for a completed task", async () => {
    const result = await syncReminders([
      task("Done thing", [stamp(NOW + 10 * MINUTE)], {
        completed: stamp(NOW - MINUTE),
      }),
    ]);
    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(world.os.size).toBe(0);
  });

  it("never throws when the scheduler does", async () => {
    world.failNext = true;
    await expect(
      syncTaskReminders(null, task("Call Mum", [stamp(NOW + 10 * MINUTE)])),
    ).resolves.toBeUndefined();
  });
});
