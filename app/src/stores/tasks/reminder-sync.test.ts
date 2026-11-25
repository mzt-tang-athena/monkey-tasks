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
    step: number;
    weight: "harsh" | "quiet";
    buttons: boolean;
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
    step: number;
    weight: "harsh" | "quiet";
    when: number;
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
        step: ring.step,
        weight: ring.weight,
        buttons: true,
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
      "alert weight": options.weight ?? "harsh",
      reminders,
      ...(options.due != null ? { due: options.due } : {}),
      ...(options.completed != null ? { completed: options.completed } : {}),
    },
  };
}

function id(uri: string, base: number, step: number): string {
  return alertRingId(uri, base, step);
}

function stepsOf(uri: string, base: number): number[] {
  return [...world.os.values()]
    .filter((entry) => entry.data.uri === uri && entry.data.base === base)
    .map((entry) => entry.data.step)
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
  it("makes one alarm minute when a due and a reminder share it", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Pay rent", [stamp(base)], { due: stamp(base) });

    await syncReminders([note]);

    const entries = [...world.os.values()];
    expect(new Set(entries.map((entry) => entry.data.base))).toEqual(
      new Set([base]),
    );
    expect(entries.map((entry) => entry.body)).toEqual([
      "Due",
      "Due",
      "Due",
      "Due",
    ]);
  });

  it("replaces a scheduled ring that has no buttons", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);
    await syncReminders([note]);
    for (const entry of world.os.values()) {
      entry.data.buttons = false;
    }

    await syncReminders([note]);

    expect(stepsOf(note.uri, base)).toEqual([0, 1, 5, 15]);
    expect(world.cancelled).toHaveLength(4);
    expect([...world.os.values()].every((entry) => entry.data.buttons)).toBe(
      true,
    );
  });

  it("makes four harsh rings at 0, 1, 5 and 15 minutes", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);

    await syncReminders([note]);

    expect(stepsOf(note.uri, base)).toEqual([0, 1, 5, 15]);
    expect(
      [...world.os.values()]
        .map((entry) => entry.when - base)
        .sort((a, b) => a - b),
    ).toEqual([0, 1, 5, 15].map((step) => step * MINUTE));
    expect(new Set([...world.os.keys()])).toEqual(
      new Set([0, 1, 5, 15].map((step) => id(note.uri, base, step))),
    );
  });

  it("makes one quiet ring", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Stretch", [stamp(base)], { weight: "quiet" });

    await syncReminders([note]);

    expect(world.os.size).toBe(1);
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
    const whens = entries.map((entry) => entry.when);
    expect(whens).toEqual([...whens].sort((a, b) => a - b));
    expect(whens[0]).toBe(due);
    expect(
      entries.filter((entry) => entry.data.base === due).map((entry) => entry.body),
    ).toEqual(["Due", "Due", "Due", "Due"]);
    expect(
      entries
        .filter((entry) => entry.data.base === later)
        .map((entry) => entry.body),
    ).toEqual(["Task reminder", "Task reminder", "Task reminder", "Task reminder"]);
  });

  it("rings a reminder on a date-only due", async () => {
    await syncReminders([
      task("Pay rent", [stamp(NOW + 10 * MINUTE)], { due: "2999-01-01" }),
    ]);
    expect(world.os.size).toBe(4);
    expect([...world.os.values()][0].body).toBe("Task reminder");
  });
});

describe("rebuild", () => {
  it("leaves a running group's future rings alone and never re-arms a delivered one", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);
    await syncReminders([note]);
    deliver(id(note.uri, base, 0));
    deliver(id(note.uri, base, 1));

    vi.setSystemTime(base + 2 * MINUTE);
    const result = await syncReminders([note]);

    expect(result).toEqual({ scheduled: 0, skipped: true });
    expect(world.cancelled).toEqual([]);
    expect(stepsOf(note.uri, base)).toEqual([5, 15]);
    expect(world.os.has(id(note.uri, base, 0))).toBe(false);
    expect(world.delivered.has(id(note.uri, base, 0))).toBe(true);
  });

  it("does not re-arm an acknowledged group's follow-ups", async () => {
    const base = NOW + 10 * MINUTE;
    const note = task("Call Mum", [stamp(base)]);
    await syncReminders([note]);

    await acknowledgeRing({ uri: note.uri, base });
    expect(world.os.size).toBe(0);
    expect(world.cancelled).toHaveLength(4);

    vi.setSystemTime(base + 2 * MINUTE);
    await syncReminders([note]);
    expect(world.os.size).toBe(0);
  });

  it("cancels future follow-ups when the weight turns quiet", async () => {
    const base = NOW + 10 * MINUTE;
    const loud = task("Call Mum", [stamp(base)]);
    await syncReminders([loud]);

    const quiet = task("Call Mum", [stamp(base)], { weight: "quiet" });
    vi.setSystemTime(NOW + 2 * MINUTE);
    await syncReminders([quiet]);

    // The follow-ups go, and the first ring is re-armed on the quiet
    // channel, so an edit before it rings is honored.
    expect(world.cancelled.sort()).toEqual(
      [0, 1, 5, 15].map((step) => id(loud.uri, base, step)).sort(),
    );
    expect(stepsOf(quiet.uri, base)).toEqual([0]);
    expect([...world.os.values()][0].weight).toBe("quiet");
  });

  it("cancels a running harsh group when the task turns quiet", async () => {
    const base = NOW + 10 * MINUTE;
    const later = base + 40 * MINUTE;
    const loud = task("Call Mum", [stamp(base), stamp(later)]);
    await syncReminders([loud]);
    deliver(id(loud.uri, base, 0));
    deliver(id(loud.uri, base, 1));

    const quiet = task("Call Mum", [stamp(base), stamp(later)], {
      weight: "quiet",
    });
    vi.setSystemTime(base + 2 * MINUTE);
    await syncReminders([quiet]);

    expect(world.cancelled.sort()).toEqual(
      [
        ...[5, 15].map((step) => id(loud.uri, base, step)),
        ...[0, 1, 5, 15].map((step) => id(loud.uri, later, step)),
      ].sort(),
    );
    expect(stepsOf(quiet.uri, base)).toEqual([]);
    expect(world.delivered.has(id(quiet.uri, base, 0))).toBe(true);
    expect(stepsOf(quiet.uri, later)).toEqual([0]);
    expect(world.os.get(id(quiet.uri, later, 0))?.weight).toBe("quiet");
  });

  it("moves a running due group when the due changes", async () => {
    const first = NOW + 10 * MINUTE;
    const moved = first + 30 * MINUTE;
    const before = task("Pay rent", [], { due: stamp(first) });
    await syncReminders([before]);

    vi.setSystemTime(first + 2 * MINUTE);
    const after = task("Pay rent", [], { due: stamp(moved) });
    await syncReminders([after]);

    expect(world.cancelled.sort()).toEqual(
      [0, 1, 5, 15].map((step) => id(before.uri, first, step)).sort(),
    );
    expect(stepsOf(after.uri, first)).toEqual([]);
    expect(stepsOf(after.uri, moved)).toEqual([0, 1, 5, 15]);
  });

  it("cancels a removed reminder's running group and keeps the other", async () => {
    const first = NOW + 10 * MINUTE;
    const kept = first + 20 * MINUTE;
    const before = task("Call Mum", [stamp(first), stamp(kept)]);
    await syncReminders([before]);

    vi.setSystemTime(first + 2 * MINUTE);
    const after = task("Call Mum", [stamp(kept)]);
    await syncReminders([after]);

    expect(world.cancelled.sort()).toEqual(
      [0, 1, 5, 15].map((step) => id(before.uri, first, step)).sort(),
    );
    expect(stepsOf(after.uri, kept)).toEqual([0, 1, 5, 15]);
  });

  it("cancels a done task's rings", async () => {
    const base = NOW + 10 * MINUTE;
    const open = task("Call Mum", [stamp(base)]);
    await syncReminders([open]);

    const done = task("Call Mum", [stamp(base)], {
      completed: stamp(NOW),
    });
    vi.setSystemTime(NOW + 2 * MINUTE);
    await syncReminders([done]);

    expect(world.os.size).toBe(0);
    expect(world.cancelled).toHaveLength(4);
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
  it("a tick clears only that task's rings and its tray entries", async () => {
    const base = NOW + 10 * MINUTE;
    const call = task("Call Mum", [stamp(base)]);
    const post = task("Post letter", [stamp(base)]);
    await syncReminders([call, post]);
    deliver(id(call.uri, base, 0));

    const ticked = task("Call Mum", [], { completed: stamp(NOW) });
    await syncTaskReminders(call, ticked);

    expect(world.cancelled.sort()).toEqual(
      [1, 5, 15].map((step) => id(call.uri, base, step)).sort(),
    );
    expect(world.dismissed).toEqual([id(call.uri, base, 0)]);
    expect(stepsOf(post.uri, base)).toEqual([0, 1, 5, 15]);
  });

  it("clears a quiet task's tray entry on a tick", async () => {
    const base = NOW + 10 * MINUTE;
    const cue = task("Stretch", [stamp(base)], { weight: "quiet" });
    await syncReminders([cue]);
    deliver(id(cue.uri, base, 0));

    await syncTaskReminders(
      cue,
      task("Stretch", [], { weight: "quiet", completed: stamp(NOW) }),
    );

    expect(world.dismissed).toEqual([id(cue.uri, base, 0)]);
    expect(world.os.size).toBe(0);
  });

  it("moves a reminder: the old group goes, the new one is scheduled", async () => {    const first = NOW + 10 * MINUTE;
    const second = NOW + 40 * MINUTE;
    const before = task("Call Mum", [stamp(first)]);
    await syncReminders([before]);

    const after = task("Call Mum", [stamp(second)]);
    await syncTaskReminders(before, after);

    expect(world.cancelled.sort()).toEqual(
      [0, 1, 5, 15].map((step) => id(before.uri, first, step)).sort(),
    );
    expect(stepsOf(before.uri, second)).toEqual([0, 1, 5, 15]);
    expect(world.os.size).toBe(4);
  });

  it("does nothing when the reminders did not move", async () => {
    const base = NOW + 10 * MINUTE;
    const call = task("Call Mum", [stamp(base)]);
    await syncReminders([call]);

    await syncTaskReminders(call, { ...call, name: "Call Mum back" });

    expect(world.cancelled).toEqual([]);
    expect(world.os.size).toBe(4);
  });

  it("reschedules the due group when an edit moves it", async () => {
    const first = NOW + 10 * MINUTE;
    const second = NOW + 20 * MINUTE;
    const before = task("Pay rent", [], { due: stamp(first) });
    await syncReminders([before]);

    const after = task("Pay rent", [], { due: stamp(second) });
    await syncTaskReminders(before, after);

    expect(world.cancelled.sort()).toEqual(
      [0, 1, 5, 15].map((step) => id(before.uri, first, step)).sort(),
    );
    expect(stepsOf(before.uri, second)).toEqual([0, 1, 5, 15]);
  });

  it("schedules a captured task's first rings", async () => {
    const base = NOW + 10 * MINUTE;
    const captured = task("Call Mum", [stamp(base)]);
    await syncTaskReminders(null, captured);
    expect(world.os.size).toBe(4);
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
