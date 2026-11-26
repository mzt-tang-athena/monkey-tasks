import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "js-yaml";
import { MEMORY_ROOT, createMemoryVault } from "@/lib/vault/adapters/memory";
import { NoteChangedError } from "@/lib/vault/notes";
import {
  SuccessorKeptError,
  completeTask,
  dropTask,
  rescheduleTask,
  taskIsDropped,
  type ReadTask,
} from "./task-actions";
import { taskFromText } from "./task-notes";

const TASKS = `${MEMORY_ROOT}/Tasks`;

const NOW = new Date(2026, 10, 25, 10, 0, 0);

function note(fields: Record<string, string>, list: string[] = []): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
  const reminders =
    list.length === 0 ? [] : ["reminders:", ...list.map((v) => `  - ${v}`)];
  return `---\nkind: "[[tasks]]"\ncreated: 2026-11-20\n${[...lines, ...reminders].join("\n")}\n---\nBody line.\n`;
}

function frontmatter(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) {
    throw new Error("no frontmatter block");
  }
  return load(match[1]) as Record<string, unknown>;
}

function read(
  vault: ReturnType<typeof createMemoryVault>,
  name: string,
): ReadTask {
  const uri = `${TASKS}/${name}`;
  const task = taskFromText(
    { id: uri, uri, fileName: name, name: name.replace(/\.md$/, "") },
    vault.hooks.read(`Tasks/${name}`) ?? "",
  );
  if (task.data == null) {
    throw new Error(`${name} did not read`);
  }
  return { ...task, data: task.data };
}

const plain = note({ title: "Call Mum", due: "2026-11-25T11:00" }, [
  "2026-11-25T11:00",
]);
const daily = note(
  { title: "Stretch", due: "2026-11-25T08:00", recurrence: "FREQ=DAILY" },
  ["2026-11-25T08:00"],
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("completeTask", () => {
  it("writes completed to the local second and nothing else", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });

    const done = await completeTask(vault, read(vault, "Call Mum.md"), {
      spawn: true,
      taken: new Set(),
    });

    const written = vault.hooks.read("Tasks/Call Mum.md") ?? "";
    expect(frontmatter(written).completed).toBe("2026-11-25T10:00:00");
    expect(written).toBe(done.after.text);
    expect(written.replace(/completed: .*\n/, "")).toBe(plain);
    expect(done.successor).toBeUndefined();
    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Call Mum.md"]);
  });

  it("makes the next occurrence of a repeating task, due on the rule's next date", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });

    const done = await completeTask(vault, read(vault, "Stretch.md"), {
      spawn: true,
      taken: new Set(["Stretch.md"]),
    });

    expect(done.successor?.fileName).toBe("Stretch 2026-11-26.md");
    const next = frontmatter(
      vault.hooks.read("Tasks/Stretch 2026-11-26.md") ?? "",
    );
    expect(next.due).toBe("2026-11-26T08:00");
    expect(next.recurrence).toBe("FREQ=DAILY");
    expect(next["recurrence previous"]).toBe("[[Stretch]]");
    expect(next.reminders).toEqual(["2026-11-26T08:00"]);
    expect(frontmatter(vault.hooks.read("Tasks/Stretch.md") ?? "").completed).toBe(
      "2026-11-25T10:00:00",
    );
  });

  it("makes no next occurrence when asked not to", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });

    await completeTask(vault, read(vault, "Stretch.md"), {
      spawn: false,
      taken: new Set(),
    });

    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Stretch.md"]);
  });

  it("keeps a next note a failed first try made, and only completes", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    const first = await completeTask(vault, read(vault, "Stretch.md"), {
      spawn: true,
      taken: new Set(),
    });
    vault.hooks.write("Tasks/Stretch.md", daily);

    const retry = await completeTask(vault, read(vault, "Stretch.md"), {
      spawn: true,
      taken: new Set(),
      kept: first.successor,
    });

    expect(retry.successor).toBe(first.successor);
    expect(Object.keys(vault.hooks.files()).sort()).toEqual([
      "Tasks/Stretch 2026-11-26.md",
      "Tasks/Stretch.md",
    ]);
  });

  it("leaves the note as it was when the write fails", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    vault.hooks.failNext("write", "Call Mum.md");

    await expect(
      completeTask(vault, read(vault, "Call Mum.md"), {
        spawn: true,
        taken: new Set(),
      }),
    ).rejects.toThrow("write failed: Call Mum.md");

    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(plain);
  });

  it("keeps a write another app made after the read", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    const before = read(vault, "Call Mum.md");
    const elsewhere = `${plain}Edited elsewhere.\n`;
    vault.hooks.write("Tasks/Call Mum.md", elsewhere);

    await expect(
      completeTask(vault, before, { spawn: true, taken: new Set() }),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(elsewhere);
  });

  it("keeps a write another app made while the next note was made", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    const before = read(vault, "Stretch.md");
    const elsewhere = `${daily}Edited elsewhere.\n`;
    vault.hooks.write("Tasks/Stretch.md", elsewhere);

    await expect(
      completeTask(vault, before, { spawn: true, taken: new Set() }),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(vault.hooks.read("Tasks/Stretch.md")).toBe(elsewhere);
    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Stretch.md"]);
  });

  it("takes the next note back when the completion fails", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    vault.hooks.failNext("write", "Stretch.md");

    await expect(
      completeTask(vault, read(vault, "Stretch.md"), {
        spawn: true,
        taken: new Set(),
      }),
    ).rejects.toThrow("write failed: Stretch.md");

    expect(vault.hooks.files()).toEqual({ "Tasks/Stretch.md": daily });
  });

  it("names the next note it could not take back", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    vault.hooks.failNext("write", "Stretch.md");
    vault.hooks.failNext("remove", "Stretch 2026-11-26.md");

    const failure = await completeTask(vault, read(vault, "Stretch.md"), {
      spawn: true,
      taken: new Set(),
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SuccessorKeptError);
    expect((failure as SuccessorKeptError).successor.fileName).toBe(
      "Stretch 2026-11-26.md",
    );
    expect(vault.hooks.read("Tasks/Stretch 2026-11-26.md")).not.toBeNull();
  });
});

describe("dropTask", () => {
  it("writes the dropped status and no completed date, and nothing else", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });

    const dropped = await dropTask(vault, read(vault, "Call Mum.md"), {
      spawn: true,
      taken: new Set(),
    });

    const written = vault.hooks.read("Tasks/Call Mum.md") ?? "";
    expect(frontmatter(written).status).toBe("[[dropped]]");
    expect(frontmatter(written).completed).toBeUndefined();
    expect(written).toBe(dropped.after.text);
    expect(written.replace(/status: .*\n/, "")).toBe(plain);
    expect(dropped.successor).toBeUndefined();
    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Call Mum.md"]);
    expect(taskIsDropped(read(vault, "Call Mum.md").data)).toBe(true);
  });

  it("replaces a deed's status", async () => {
    const deed = note({
      title: "Call Mum",
      status: '"[[active]]"',
      due: "2026-11-25T11:00",
    });
    const vault = createMemoryVault({ "Tasks/Call Mum.md": deed });

    await dropTask(vault, read(vault, "Call Mum.md"), {
      spawn: true,
      taken: new Set(),
    });

    expect(
      frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "").status,
    ).toBe("[[dropped]]");
  });

  it("skips one occurrence: the next note is made and this one is dropped", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });

    const dropped = await dropTask(vault, read(vault, "Stretch.md"), {
      spawn: true,
      taken: new Set(["Stretch.md"]),
    });

    expect(dropped.successor?.fileName).toBe("Stretch 2026-11-26.md");
    const next = frontmatter(
      vault.hooks.read("Tasks/Stretch 2026-11-26.md") ?? "",
    );
    expect(next.due).toBe("2026-11-26T08:00");
    expect(next["recurrence previous"]).toBe("[[Stretch]]");
    expect(next.status).toBeUndefined();
    const skipped = frontmatter(vault.hooks.read("Tasks/Stretch.md") ?? "");
    expect(skipped.status).toBe("[[dropped]]");
    expect(skipped.completed).toBeUndefined();
  });

  it("takes the next note back when the drop fails", async () => {
    const vault = createMemoryVault({ "Tasks/Stretch.md": daily });
    vault.hooks.failNext("write", "Stretch.md");

    await expect(
      dropTask(vault, read(vault, "Stretch.md"), {
        spawn: true,
        taken: new Set(["Stretch.md"]),
      }),
    ).rejects.toThrow();

    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Stretch.md"]);
    expect(vault.hooks.read("Tasks/Stretch.md")).toBe(daily);
  });
});

describe("rescheduleTask", () => {
  it("moves the due and its one reminder to the target", async () => {
    const vault = createMemoryVault({
      "Tasks/Call Mum.md": note({ title: "Call Mum", due: "2026-11-25T09:00" }, [
        "2026-11-25T08:30",
        "2026-11-25T09:00",
      ]),
    });

    const moved = await rescheduleTask(
      vault,
      read(vault, "Call Mum.md"),
      "2026-11-26T09:00",
    );

    const fields = frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "");
    expect(fields.due).toBe("2026-11-26T09:00");
    expect(fields.reminders).toEqual(["2026-11-26T09:00"]);
    expect(fields.completed).toBeUndefined();
    expect(moved.after.data?.due).toBe("2026-11-26T09:00");
    expect(moved.after.data?.reminders).toEqual(["2026-11-26T09:00"]);
  });

  it("gives a task with no due a due and a reminder", async () => {
    const vault = createMemoryVault({
      "Tasks/Call Mum.md": note({ title: "Call Mum" }),
    });

    await rescheduleTask(vault, read(vault, "Call Mum.md"), "2026-11-25T12:00");

    const fields = frontmatter(vault.hooks.read("Tasks/Call Mum.md") ?? "");
    expect(fields.due).toBe("2026-11-25T12:00");
    expect(fields.reminders).toEqual(["2026-11-25T12:00"]);
  });

  it("moves a month-end rule to the new due day, and keeps it on the same day", async () => {
    const rent = note({
      title: "Rent",
      due: "2026-11-30T09:00",
      recurrence: "FREQ=MONTHLY;BYMONTHDAY=-1",
    });
    const vault = createMemoryVault({ "Tasks/Rent.md": rent });

    await rescheduleTask(vault, read(vault, "Rent.md"), "2026-11-30T17:00");
    const sameDay = frontmatter(vault.hooks.read("Tasks/Rent.md") ?? "");
    expect(sameDay.due).toBe("2026-11-30T17:00");
    expect(sameDay.recurrence).toBe("FREQ=MONTHLY;BYMONTHDAY=-1");

    await rescheduleTask(vault, read(vault, "Rent.md"), "2026-12-01T09:00");
    const moved = frontmatter(vault.hooks.read("Tasks/Rent.md") ?? "");
    expect(moved.due).toBe("2026-12-01T09:00");
    expect(moved.recurrence).toBe("FREQ=MONTHLY");
  });

  it("refuses a note another app changed since it was read", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    const before = read(vault, "Call Mum.md");
    vault.hooks.write("Tasks/Call Mum.md", `${plain}\nEdited elsewhere.\n`);

    await expect(
      rescheduleTask(vault, before, "2026-11-26T09:00"),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(
      `${plain}\nEdited elsewhere.\n`,
    );
  });

  it("leaves the note as it was when the write fails", async () => {
    const vault = createMemoryVault({ "Tasks/Call Mum.md": plain });
    vault.hooks.failNext("write", "Call Mum.md");

    await expect(
      rescheduleTask(vault, read(vault, "Call Mum.md"), "2026-11-26T09:00"),
    ).rejects.toThrow("write failed: Call Mum.md");

    expect(vault.hooks.read("Tasks/Call Mum.md")).toBe(plain);
  });
});
