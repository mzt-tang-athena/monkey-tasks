import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "js-yaml";

// A press on a reminder's button runs with no screen. These tests run
// the whole press against the memory vault and a fake alarm list, and
// read the notes back, as the operator would on disk.

type Stored = {
  id: string;
  data: {
    uri: string;
    base: number;
    weight: "harsh" | "quiet";
    buttons: boolean;
  };
};

const world = vi.hoisted(() => ({
  os: new Map<string, Stored>(),
  delivered: new Map<string, Stored>(),
  cancelled: [] as string[],
  dismissed: [] as string[],
  posted: [] as { id: string; title: string; body: string; uri: string }[],
  cleared: [] as string[],
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system", async () => {
  const { sharedFakeAppFiles } = await import("@/testing/fake-app-files");
  return {
    File: sharedFakeAppFiles.File,
    Paths: { document: sharedFakeAppFiles.document },
  };
});

vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: async () => true,
  ensureChannels: async () => undefined,
  scheduleRing: async (ring: {
    id: string;
    uri: string;
    base: number;
    weight: "harsh" | "quiet";
  }) => {
    world.os.set(ring.id, {
      id: ring.id,
      data: {
        uri: ring.uri,
        base: ring.base,
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
  listScheduledDetailed: async () => [...world.os.values()],
  listDeliveredDetailed: async () => [...world.delivered.values()],
  dismissDelivered: async (ids: string[]) => {
    for (const id of ids) {
      world.dismissed.push(id);
      world.delivered.delete(id);
    }
  },
  postActionFailure: async (input: {
    id: string;
    title: string;
    body: string;
    uri: string;
  }) => {
    world.posted.push(input);
  },
  clearActionFailureNotice: async (id: string) => {
    world.cleared.push(id);
  },
}));

import { MEMORY_ROOT, createMemoryVault } from "@/lib/vault/adapters/memory";
import { alertRingId } from "@/lib/alerts/rings";
import {
  loadActionFailures,
  recordActionFailure,
} from "@/lib/alerts/action-failures";
import { sharedFakeAppFiles } from "@/testing/fake-app-files";
import { parseStoredDate } from "@/utils/dates";
import {
  clearDoneFailure,
  clearDropFailure,
  performAlertPress,
  pressOf,
  type AlertPress,
} from "./alert-actions";
import { syncReminders } from "./reminder-sync";
import { taskFromText } from "./task-notes";

const NOW = new Date(2026, 10, 25, 10, 0, 0);
const TASKS = `${MEMORY_ROOT}/Tasks`;

function note(fields: Record<string, string>, reminders: string[]): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
  const list = reminders.map((value) => `  - ${value}`);
  return `---\nkind: "[[tasks]]"\ncreated: 2026-11-20\n${lines.join("\n")}\nreminders:\n${list.join("\n")}\n---\nBody line.\n`;
}

function frontmatter(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) {
    throw new Error("no frontmatter block");
  }
  return load(match[1]) as Record<string, unknown>;
}

const DUE = "2026-11-25T10:30";
const plain = note({ title: "Call Mum", due: DUE }, [DUE]);
const daily = note(
  { title: "Stretch", due: DUE, recurrence: "FREQ=DAILY" },
  [DUE],
);

function when(stored: string): number {
  return parseStoredDate(stored)?.date.getTime() ?? Number.NaN;
}

function press(
  name: string,
  action: AlertPress["action"],
  key = `${name}|${action.kind}`,
): AlertPress {
  return {
    uri: `${TASKS}/${name}.md`,
    base: when(DUE),
    action,
    name,
    key,
  };
}

async function arm(vault: ReturnType<typeof createMemoryVault>, name: string) {
  const uri = `${TASKS}/${name}.md`;
  const task = taskFromText(
    { id: uri, uri, fileName: `${name}.md`, name },
    vault.hooks.read(`Tasks/${name}.md`) ?? "",
  );
  await syncReminders([task]);
}

function ringIdsOf(name: string, stored: string): string[] {
  return [alertRingId(`${TASKS}/${name}.md`, when(stored))];
}

beforeEach(() => {
  world.os.clear();
  world.delivered.clear();
  world.cancelled.length = 0;
  world.dismissed.length = 0;
  world.posted.length = 0;
  world.cleared.length = 0;
  sharedFakeAppFiles.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Done", () => {
  it("completes the note and clears every ring of the task", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");
    expect([...world.os.keys()].sort()).toEqual(ringIdsOf("Call Mum", DUE).sort());

    await performAlertPress(vault, press("Call Mum", { kind: "done" }));

    const fields = frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "");
    expect(fields.completed).toBe("2026-11-25T10:00:00");
    expect(world.os.size).toBe(0);
    expect(loadActionFailures()).toEqual([]);
  });

  it("dismisses the ring that is in the tray", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");
    const [first] = [...world.os.values()];
    world.os.delete(first.id);
    world.delivered.set(first.id, first);

    await performAlertPress(vault, press("Call Mum", { kind: "done" }));

    expect(world.dismissed).toContain(first.id);
    expect(world.delivered.size).toBe(0);
  });

  it("makes the next occurrence of a repeating task and arms its alarm", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    await arm(vault, "Stretch");

    await performAlertPress(vault, press("Stretch", { kind: "done" }));

    const files = Object.keys(vault.hooks.files()).sort();
    expect(files).toEqual(["Tasks/Stretch 2026-11-26.md", "Tasks/Stretch.md"]);
    const next = frontmatter(
      vault.hooks.read("Tasks/Stretch 2026-11-26.md") ?? "",
    );
    expect(next.due).toBe("2026-11-26T10:30");
    const base = when("2026-11-26T10:30");
    expect(
      [...world.os.values()].map((entry) => entry.data.base),
    ).toEqual(expect.arrayContaining([base]));
    expect([...world.os.values()].every((entry) => entry.data.base === base)).toBe(
      true,
    );
  });

  it("does nothing on a note that is already done, and still clears the ring", async () => {
    const vault = createMemoryVault({
      "Tasks/Call Mum.md": plain.replace(
        "due:",
        "completed: 2026-11-25T09:00:00\ndue:",
      ),
    });
    const before = vault.hooks.read("Tasks/Call Mum.md");
    const ring = {
      id: alertRingId(`${TASKS}/Call Mum.md`, when(DUE)),
      data: {
        uri: `${TASKS}/Call Mum.md`,
        base: when(DUE),
        weight: "harsh" as const,
        buttons: true,
      },
    };
    world.delivered.set(ring.id, ring);

    await performAlertPress(vault, press("Call Mum", { kind: "done" }));

    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(before);
    expect(world.dismissed).toEqual([ring.id]);
  });

  it("acts once when the same press arrives twice", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    await arm(vault, "Stretch");
    const same = press("Stretch", { kind: "done" }, "ring-1|done");

    await performAlertPress(vault, same);
    await performAlertPress(vault, same);

    expect(Object.keys(vault.hooks.files())).toHaveLength(2);
  });

  it("makes one next occurrence when two presses race", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    vault.hooks.setLatency(5);
    await arm(vault, "Stretch");

    await Promise.all([
      performAlertPress(vault, press("Stretch", { kind: "done" }, "a|done")),
      performAlertPress(vault, press("Stretch", { kind: "done" }, "b|done")),
    ]);

    expect(Object.keys(vault.hooks.files())).toHaveLength(2);
  });
});

describe("Didn't do", () => {
  it("drops a one-off task with no completed date, and clears its rings", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");

    await performAlertPress(vault, press("Call Mum", { kind: "drop" }));

    const fields = frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "");
    expect(fields.status).toBe("[[dropped]]");
    expect(fields.completed).toBeUndefined();
    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Call Mum.md"]);
    expect(world.os.size).toBe(0);
    expect(loadActionFailures()).toEqual([]);
  });

  it("replaces the status of a deed, and keeps its body", async () => {
    const deed = plain.replace("due:", 'status: "[[backlog]]"\ndue:');
    const vault = createMemoryVault({ "Tasks/Call Mum.md": deed });
    await arm(vault, "Call Mum");

    await performAlertPress(vault, press("Call Mum", { kind: "drop" }));

    const text = vault.hooks.read("Tasks/Call Mum.md") ?? "";
    expect(frontmatter(text).status).toBe("[[dropped]]");
    expect(text).toContain("Body line.");
  });

  it("skips one occurrence of a repeating task and spawns the next", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    await arm(vault, "Stretch");

    await performAlertPress(vault, press("Stretch", { kind: "drop" }));

    expect(Object.keys(vault.hooks.files()).sort()).toEqual([
      "Tasks/Stretch 2026-11-26.md",
      "Tasks/Stretch.md",
    ]);
    const skipped = frontmatter(vault.hooks.read("Tasks/Stretch.md") ?? "");
    expect(skipped.status).toBe("[[dropped]]");
    expect(skipped.completed).toBeUndefined();
    const next = frontmatter(
      vault.hooks.read("Tasks/Stretch 2026-11-26.md") ?? "",
    );
    expect(next.due).toBe("2026-11-26T10:30");
    expect(next.status).toBeUndefined();
    expect(next.completed).toBeUndefined();
    const base = when("2026-11-26T10:30");
    expect(world.os.size).toBeGreaterThan(0);
    expect([...world.os.values()].every((entry) => entry.data.base === base)).toBe(
      true,
    );
  });

  it("does nothing on a note that is already dropped, whatever the press key", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    await arm(vault, "Stretch");
    await performAlertPress(vault, press("Stretch", { kind: "drop" }, "a|didnt"));
    const after = vault.hooks.files();

    await performAlertPress(vault, press("Stretch", { kind: "drop" }, "b|didnt"));
    await performAlertPress(vault, press("Stretch", { kind: "done" }, "c|done"));

    expect(vault.hooks.files()).toEqual(after);
  });

  it("gives its claim back after a failed write, so a second press lands", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");
    vault.hooks.failNext("write", "Call Mum.md");
    const same = press("Call Mum", { kind: "drop" }, "ring|didnt");

    await performAlertPress(vault, same);

    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(plain);
    expect(world.posted[0].title).toBe("Didn't do did not save");
    expect(loadActionFailures()).toMatchObject([
      { name: "Call Mum", action: { kind: "drop" } },
    ]);

    await performAlertPress(vault, same);

    expect(
      frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "").status,
    ).toBe("[[dropped]]");
  });
});

describe("Reschedule", () => {
  const target = "2026-11-25T12:30";

  it("moves the due and the reminder, and the rings move with them", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");

    await performAlertPress(
      vault,
      press("Call Mum", { kind: "reschedule", target }),
    );

    const fields = frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "");
    expect(fields.due).toBe(target);
    expect(fields.reminders).toEqual([target]);
    expect(fields.completed).toBeUndefined();
    expect([...world.os.keys()].sort()).toEqual(ringIdsOf("Call Mum", target).sort());
    expect(
      [...world.os.values()].every((entry) => entry.data.base === when(target)),
    ).toBe(true);
  });

  it("dismisses the ring in the tray and cancels its follow-ups", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");
    const rings = [...world.os.values()];
    const [first, ...rest] = rings;
    world.os.delete(first.id);
    world.delivered.set(first.id, first);

    await performAlertPress(
      vault,
      press("Call Mum", { kind: "reschedule", target }),
    );

    expect(world.dismissed).toContain(first.id);
    for (const entry of rest) {
      expect(world.cancelled).toContain(entry.id);
    }
    expect(world.delivered.size).toBe(0);
  });
});

describe("a failed write", () => {
  it("leaves the note and the ring, and says so", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");
    const rings = [...world.os.keys()].sort();
    vault.hooks.failNext("write", "Call Mum.md");

    await performAlertPress(vault, press("Call Mum", { kind: "done" }));

    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(plain);
    expect([...world.os.keys()].sort()).toEqual(rings);
    expect(world.dismissed).toEqual([]);
    expect(world.posted).toHaveLength(1);
    expect(world.posted[0]).toMatchObject({
      title: "Done did not save",
      body: "Call Mum: write failed: Call Mum.md",
      uri: `${TASKS}/Call Mum.md`,
    });
    expect(loadActionFailures()).toMatchObject([
      { name: "Call Mum", action: { kind: "done" } },
    ]);
  });

  it("keeps a reschedule's chosen moment for the retry", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");
    vault.hooks.failNext("write", "Call Mum.md");
    const target = "2026-11-25T12:30";

    await performAlertPress(
      vault,
      press("Call Mum", { kind: "reschedule", target }),
    );

    expect(loadActionFailures()).toMatchObject([
      { action: { kind: "reschedule", target } },
    ]);
    expect(world.posted[0].title).toBe("Snooze did not save");
  });

  it("reports a note that is gone", async () => {
    const vault = createMemoryVault({});
    await vault.makeFolder(MEMORY_ROOT, "Tasks");

    await performAlertPress(vault, press("Call Mum", { kind: "done" }));

    expect(world.posted[0].body).toBe("Call Mum: the note is gone");
  });

  it("clears the failure when a retry lands", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    await arm(vault, "Call Mum");
    vault.hooks.failNext("write", "Call Mum.md");
    const same = press("Call Mum", { kind: "done" }, "ring-1|done");
    await performAlertPress(vault, same);
    expect(loadActionFailures()).toHaveLength(1);

    await performAlertPress(vault, same, { retry: true });

    expect(loadActionFailures()).toEqual([]);
    expect(world.cleared).toHaveLength(1);
    expect(
      frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "").completed,
    ).toBe("2026-11-25T10:00:00");
    expect(world.os.size).toBe(0);
  });

  it("drops the claim, so a second press on the same reminder acts", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    vault.hooks.failNext("write", "Call Mum.md");
    const same = press("Call Mum", { kind: "done" }, "ring-1|done");

    await performAlertPress(vault, same);
    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(plain);

    await performAlertPress(vault, same);

    expect(
      frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "").completed,
    ).toBe("2026-11-25T10:00:00");
    expect(world.posted).toHaveLength(1);
    expect(loadActionFailures()).toEqual([]);
  });

  it("still acts once when a delivered press arrives twice and lands", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    const same = press("Stretch", { kind: "done" }, "ring-1|done");

    await performAlertPress(vault, same);
    await performAlertPress(vault, same);

    expect(Object.keys(vault.hooks.files())).toHaveLength(2);
  });
});

describe("clearDoneFailure", () => {
  const uri = `${TASKS}/Call Mum.md`;

  beforeEach(() => {
    recordActionFailure({
      id: `${uri}|done`,
      uri,
      name: "Call Mum",
      action: { kind: "done" },
      message: "disk full",
      at: 1,
    });
    recordActionFailure({
      id: `${uri}|reschedule`,
      uri,
      name: "Call Mum",
      action: { kind: "reschedule", target: "2026-11-26T09:00" },
      message: "disk full",
      at: 1,
    });
  });

  it("drops the Done record and its notice, and keeps a Reschedule one", () => {
    clearDoneFailure(uri);

    expect(loadActionFailures().map((entry) => entry.id)).toEqual([
      `${uri}|reschedule`,
    ]);
    expect(world.cleared).toEqual([`${uri}|done`]);
  });

  it("does nothing for another task", () => {
    clearDoneFailure(`${TASKS}/Stretch.md`);

    expect(loadActionFailures()).toHaveLength(2);
    expect(world.cleared).toEqual([]);
  });
});

describe("clearDropFailure", () => {
  const uri = `${TASKS}/Call Mum.md`;

  beforeEach(() => {
    for (const action of [{ kind: "drop" }, { kind: "done" }] as const) {
      recordActionFailure({
        id: `${uri}|${action.kind}`,
        uri,
        name: "Call Mum",
        action,
        message: "disk full",
        at: 1,
      });
    }
  });

  it("drops the Didn't do record and its notice, and keeps a Done one", () => {
    clearDropFailure(uri);

    expect(loadActionFailures().map((entry) => entry.id)).toEqual([
      `${uri}|done`,
    ]);
    expect(world.cleared).toEqual([`${uri}|drop`]);
  });

  it("does nothing for another task", () => {
    clearDropFailure(`${TASKS}/Stretch.md`);

    expect(loadActionFailures()).toHaveLength(2);
    expect(world.cleared).toEqual([]);
  });
});

describe("pressOf", () => {
  const base = { uri: "u", name: "Call Mum", key: "k" };

  it("reads the Done button", () => {
    expect(pressOf({ ...base, button: "done", base: 5 })).toEqual({
      uri: "u",
      base: 5,
      action: { kind: "done" },
      name: "Call Mum",
      key: "k",
    });
  });

  it("ignores a tap on the notification and a button this build lacks", () => {
    expect(pressOf(base)).toBeNull();
    expect(pressOf({ ...base, button: "gone" })).toBeNull();
  });
});
