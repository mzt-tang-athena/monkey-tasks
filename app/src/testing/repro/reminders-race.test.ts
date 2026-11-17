// Reproductions of audit finding 2, written as `it.fails` before the
// fix. Ticket 0052 fixed the bug and made them plain tests.
//
// The store ran a full alarm rebuild on every cache change, and a
// per-task sync after each write. Nothing ordered them, so two
// rebuilds, or a rebuild and a per-task sync, interleaved and
// scheduled one reminder twice. The phone then rang twice. Now every
// alarm call waits its turn on one chain.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  syncReminders,
  syncTaskReminders,
} from "@/stores/tasks/reminder-sync";
import type { TaskItem } from "@/types/task";

const alarms = new Map<string, string>();
let schedules = 0;

/** Every scheduler call yields once, like a native bridge call. */
function bridge(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
}

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

vi.mock("@/lib/alerts/acked", () => ({
  loadAcked: () => ({}),
  isAcked: () => false,
  recordAcks: () => undefined,
}));

vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: async () => {
    await bridge();
    return true;
  },
  ensureChannels: async () => undefined,
  scheduleRing: async (ring: { id: string; title: string }) => {
    await bridge();
    if (!alarms.has(ring.id)) {
      schedules += 1;
    }
    alarms.set(ring.id, ring.title);
    return ring.id;
  },
  cancelScheduled: async (id: string) => {
    await bridge();
    alarms.delete(id);
  },
  listScheduledDetailed: async () =>
    [...alarms.keys()].map((id) => ({ id, data: null })),
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
      "alert weight": "harsh",
      reminders: ["2999-01-01T09:00"],
      ...(open ? {} : { completed: "2026-10-26" }),
    },
  };
}

beforeEach(() => {
  alarms.clear();
  schedules = 0;
});

describe("alarm sync races (ticket 0052)", () => {
  it("schedules each reminder once when two rebuilds overlap", async () => {
    const tasks = ["A", "B", "C", "D"].map((name) => task(name));
    await Promise.all([syncReminders(tasks), syncReminders(tasks)]);
    // Four tasks, a harsh alert's four rings each, scheduled once.
    expect(alarms.size).toBe(16);
    expect(schedules).toBe(16);
  });

  it("schedules a reopened task once when a rebuild overlaps", async () => {
    const before = [task("A"), task("B"), task("C"), task("D", false)];
    await syncReminders(before);
    expect(alarms.size).toBe(12);
    const reopened = task("D");
    const after = [...before.slice(0, 3), reopened];
    await Promise.all([
      syncReminders(after),
      syncTaskReminders(task("D", false), reopened),
    ]);
    expect([...alarms.values()].filter((name) => name === "D")).toHaveLength(4);
    expect(schedules).toBe(16);
  });
});
