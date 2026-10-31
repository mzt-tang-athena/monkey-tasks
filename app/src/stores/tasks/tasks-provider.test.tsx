/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the provider's hooks through
// module bindings, which is the shape the rule forbids in app code.
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { act, create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The store's contract after ADR 0017: a tap changes the row before any
// file I/O, and the vault is not read again. The store runs on a memory
// vault (ADR 0037). A thin wrapper around it counts, holds and fails
// the calls, and the loader mock counts and holds the reads.

const writes: { uri: string; text: string }[] = [];
let loadCalls = 0;
let releaseWrite: (() => void) | null = null;
let holdWrites = false;
let heldOnce = false;
let failWrite = false;
let loadGate: Promise<void> | null = null;
let createFails = false;
let deleteFails = false;
let renameOnCreate = false;
const creates: { fileName: string; content: string }[] = [];
const deletes: string[] = [];

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

vi.mock("./load-vault", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./load-vault")>();
  return {
    ...actual,
    loadVault: async (...args: Parameters<typeof actual.loadVault>) => {
      loadCalls += 1;
      if (loadGate) {
        await loadGate;
      }
      return actual.loadVault(...args);
    },
  };
});

vi.mock("./reminder-sync", () => ({
  syncReminders: async () => ({ scheduled: 0, skipped: true }),
  syncTaskReminders: async () => undefined,
}));

import { makeQueryClient } from "@/lib/react-query";
import type { VaultAdapter } from "@/lib/vault/adapter";
import {
  MEMORY_ROOT,
  createMemoryVault,
  type MemoryVault,
  type VaultSeed,
} from "@/lib/vault/adapters/memory";
import { PREVIEW_SEEDS, sampleSeed } from "@/lib/vault/sample/seed";
import { VaultProvider } from "@/lib/vault/vault-provider";
import { todayIso } from "@/utils/dates";
import { TasksProvider } from "./tasks-provider";
import type { TaskListData } from "./tasks-provider";
import { useStoreMeta, useTaskList } from "./task-state";
import type { StoreMeta } from "./task-state";
import { useTaskActions } from "./task-actions";
import type { TaskActions } from "./task-actions";
import type { TaskItem } from "@/types/task";
import { spawnContent } from "./spawn";

const TASKS = `${MEMORY_ROOT}/Tasks`;
const CALL_TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nBody.\n';
const FOCUS_TEXT = '---\nkind: "[[lists]]"\ncreated: 2026-10-20\n---\n';

/** The vault the store runs on: Call, and the Focus list. */
let vault: MemoryVault;

/** The memory vault, with each call counted, held or failed. */
function instrumented(inner: MemoryVault): VaultAdapter {
  return {
    ...inner,
    async write(uri, text) {
      if (failWrite) {
        throw new Error("disk full");
      }
      writes.push({ uri, text });
      if (holdWrites && !heldOnce) {
        heldOnce = true;
        const gate = Promise.withResolvers<void>();
        releaseWrite = gate.resolve;
        await gate.promise;
      }
      return inner.write(uri, text);
    },
    async create(folderUri, fileName, text) {
      if (createFails) {
        throw new Error("no space");
      }
      // A provider that appends " (1)" to the name it is handed.
      const asked = renameOnCreate
        ? fileName.replace(/\.md$/, " (1).md")
        : fileName;
      const made = await inner.create(folderUri, asked, text);
      creates.push({ fileName: made.fileName, content: text });
      return made;
    },
    async remove(uri) {
      if (deleteFails) {
        throw new Error("locked");
      }
      deletes.push(uri);
      return inner.remove(uri);
    },
  };
}

/** The three contexts read as one snapshot, for the assertions below. */
type Snapshot = StoreMeta & TaskActions & { tasks: TaskItem[] };

let latest: Snapshot | null = null;
let latestActions: TaskActions | null = null;
let queryClient: QueryClient | null = null;

function Probe() {
  const tasks = useTaskList();
  const meta = useStoreMeta();
  const actions = useTaskActions();
  latest = { ...meta, ...actions, tasks };
  latestActions = actions;
  return null;
}

/**
 * React Query notifies its observers on a timer, not on the promise that
 * resolved the fetch, so a flush has to cross a macrotask before the
 * Probe renders the cache. A few turns cover a mutation whose write
 * chain settles and then reports.
 */
async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 3; turn += 1) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 0);
      await promise;
    }
  });
}

/** Mount the store on `vault`, or on a new vault with `seed`. */
async function mount(seed?: VaultSeed): Promise<ReactTestRenderer> {
  if (seed != null) {
    vault = createMemoryVault(seed);
  }
  const adapter = instrumented(vault);
  const client = makeQueryClient();
  // The app retries a vault read once; a test wants the failure now, and
  // the cache must outlive every render.
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retry: false, gcTime: Infinity },
  });
  queryClient = client;

  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <VaultProvider adapter={adapter}>
          <TasksProvider>
            <Probe />
          </TasksProvider>
        </VaultProvider>
      </QueryClientProvider>,
    );
  });
  // Boot: the saved root, then the vault read behind it.
  await flush();
  return renderer as unknown as ReactTestRenderer;
}

function row(): TaskItem {
  return byFile("Call.md");
}

function byFile(fileName: string): TaskItem {
  const task = latest?.tasks.find((item) => item.fileName === fileName);
  if (task == null) {
    throw new Error(`the task ${fileName} is not in the store`);
  }
  return task;
}

function cachedList(): TaskListData | undefined {
  return queryClient!.getQueryData<TaskListData>(["tasks", MEMORY_ROOT]);
}

/** A recurring occurrence, for the completion tests. */
function recurring(due: string, completed?: string): string {
  return [
    "---",
    'kind: "[[tasks]]"',
    "created: 2026-10-20",
    `due: ${due}`,
    "recurrence: FREQ=WEEKLY",
    ...(completed == null ? [] : [`completed: ${completed}`]),
    "---",
    "\nWater.\n",
  ].join("\n");
}

const SPAWN_FILE = "Water plants 2026-10-27.md";
const SPAWN_URI = `${TASKS}/${SPAWN_FILE}`;

/** The successor a tick made, untouched unless `body` differs. */
function spawnOf(body = "\nWater.\n"): string {
  return spawnContent(
    {
      title: "Water plants",
      previous: "Water plants",
      due: "2026-10-27",
      recurrence: "FREQ=WEEKLY",
      lists: [],
      reminders: [],
      body,
    },
    "2026-10-24",
  );
}

beforeEach(() => {
  vault = createMemoryVault({
    "Tasks/Call.md": CALL_TEXT,
    "Tasks/Lists/Focus.md": FOCUS_TEXT,
  });
  writes.length = 0;
  loadCalls = 0;
  releaseWrite = null;
  holdWrites = false;
  heldOnce = false;
  failWrite = false;
  loadGate = null;
  createFails = false;
  deleteFails = false;
  renameOnCreate = false;
  creates.length = 0;
  deletes.length = 0;
  latest = null;
  latestActions = null;
  queryClient = null;
});

describe("TasksProvider", () => {
  it("lands a toggle whose note moved on since it was read", async () => {
    // A fast tick, untick, tick can reach the file behind an earlier
    // write. The toggle re-reads the note and applies itself to what
    // is there, instead of failing and leaving the row unticked.
    await mount();
    // Another app edits the note after the read.
    vault.hooks.write(
      "Tasks/Call.md",
      '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nedited: yes\n---\n\nBody.\n',
    );

    await act(async () => {
      await latest!.toggle(row());
    });
    await flush();

    expect(latest!.lastError).toBeNull();
    expect(row().data?.completed).toBeDefined();
    const last = writes[writes.length - 1];
    expect(last.text).toContain("edited: yes");
    expect(last.text).toContain("completed:");
  });

  it("ticks the row before the write lands, and does not read the vault", async () => {
    await mount();
    expect(loadCalls).toBe(1);
    const actionsBeforeTick = latestActions;
    holdWrites = true;

    await act(async () => {
      void latest!.toggle(row());
    });
    // The write is still held; only the cache and the render move.
    await flush();

    // The write is still pending, and the row is already done.
    expect(writes).toHaveLength(1);
    expect(row().data?.completed).toBeDefined();
    expect(row().text).toContain("completed:");
    // The tick is in the cache, which is where every row consumer reads.
    const cached = cachedList();
    const cachedRow = cached?.tasks.find((item) => item.name === "Call");
    expect(cachedRow?.data?.completed).toBeDefined();
    // The tick changed the rows, not the actions: their identity holds.
    expect(latestActions).toBe(actionsBeforeTick);
    // No reload: the vault read count did not move.
    expect(loadCalls).toBe(1);

    await act(async () => {
      releaseWrite?.();
      await Promise.resolve();
    });
    await flush();
    expect(loadCalls).toBe(1);
  });

  it("re-reads when a write lands while the read runs", async () => {
    await mount();
    const booted = loadCalls;
    const gate = Promise.withResolvers<void>();
    loadGate = gate.promise;

    // The read starts and blocks inside the loader.
    let refreshing: Promise<void> | null = null;
    await act(async () => {
      refreshing = latest!.refresh();
    });
    await flush();
    expect(loadCalls).toBe(booted + 1);

    // A write is queued and lands while that read is still open.
    await act(async () => {
      void latest!.toggle(row());
    });
    await flush();

    // Release the read. Its result predates the write, so the store
    // reads again instead of dropping the new text.
    loadGate = null;
    gate.resolve();
    await act(async () => {
      await refreshing;
    });
    await flush();
    expect(loadCalls).toBe(booted + 2);
  });

  it("chains two quick taps on one note", async () => {
    await mount();
    holdWrites = true;

    await act(async () => {
      void latest!.toggle(row());
      void latest!.toggle(row());
    });
    await flush();
    // The row already shows the second tap's result.
    expect(row().data?.completed).toBeUndefined();
    // Writes to one note are serialized: the second waits its turn.
    expect(writes).toHaveLength(1);

    await act(async () => {
      releaseWrite?.();
      await Promise.resolve();
    });
    await flush();
    expect(writes).toHaveLength(2);
    expect(writes[1].text).not.toContain("completed");
    expect(loadCalls).toBe(1);
  });

  it("captures a row before its file exists", async () => {
    await mount();
    const before = latest!.tasks.length;

    await act(async () => {
      await latest!.capture(
        {
          name: "Water plants",
          due: "2026-10-23",
        },
        { kind: "main" },
      );
    });
    await flush();

    expect(latest!.tasks.length).toBe(before + 1);
    const captured = latest!.tasks.find((item) => item.name === "Water plants");
    expect(captured?.uri).toBe(`${TASKS}/Water plants.md`);
    expect(vault.hooks.read("Tasks/Water plants.md")).toBe(captured?.text);
    // A capture still reads no notes: only the boot load happened.
    expect(loadCalls).toBe(1);
  });

  it("keeps the typed name when the provider renames the file", async () => {
    renameOnCreate = true;
    await mount();

    await act(async () => {
      await latest!.capture(
        { name: "Water plants", due: "2026-10-23" },
        { kind: "main" },
      );
    });
    await flush();

    const captured = latest!.tasks.find((item) => item.name === "Water plants");
    expect(captured?.fileName).toBe("Water plants (1).md");
    // The row carries the text and data the file really has, so the
    // next write compares against the right bytes.
    expect(captured?.text).toContain("title: Water plants");
    expect(captured?.data?.title).toBe("Water plants");
  });

  it("edits the row by id and keeps the list tabs", async () => {
    await mount();
    const before = row();

    await act(async () => {
      await latest!.edit(before, {
        name: "Call",
        due: "2026-10-25",
        recurrence: null,
        lists: ["Focus"],
        reminders: [],
        body: "\nNew body.\n",
      });
    });
    await flush();

    const after = row();
    expect(after.uri).toBe(before.uri);
    expect(after.id).toBe(before.id);
    expect(after.data?.due).toBe("2026-10-25");
    expect(after.text).toContain("due: 2026-10-25");
    expect(after.body).toBe("\nNew body.\n");
    expect(writes).toHaveLength(1);
    expect(writes[0].text).toBe(after.text);
    // The edit moved the rows, not the tabs.
    const cached = cachedList();
    expect(cached?.lists.map((item) => item.name)).toEqual(["Focus"]);
    expect(loadCalls).toBe(1);
  });

  it("leaves the row in place when an edit fails", async () => {
    await mount();
    const before = row();
    const actionsBeforeEdit = latestActions;
    failWrite = true;

    await act(async () => {
      await expect(
        latest!.edit(before, {
          name: "Call",
          due: "2026-10-25",
          recurrence: null,
          lists: [],
          reminders: [],
          body: before.body,
        }),
      ).rejects.toThrow("disk full");
    });
    await flush();

    const after = row();
    expect(after.text).toBe(before.text);
    expect(after.data?.due).toBeUndefined();
    expect(after.name).toBe("Call");
    expect(latest!.lastError).toContain("task edit");
    // The failure changed the banner, not the actions' identity.
    expect(latestActions).toBe(actionsBeforeEdit);
  });

  it("edits a sample row in the browser preview through the memory vault", async () => {
    await mount(sampleSeed(PREVIEW_SEEDS, todayIso()));
    // The preview reads the sample vault once.
    expect(loadCalls).toBe(1);
    const before = latest!.tasks.find(
      (item) => item.name === "Water the plants",
    );
    if (before == null) {
      throw new Error("the sample task is not in the store");
    }

    await act(async () => {
      await latest!.edit(before, {
        name: "Water the ferns",
        due: "2026-10-30",
        recurrence: null,
        lists: ["Focus"],
        reminders: ["2026-10-30T09:00"],
        body: "\nNew body.\n",
      });
    });
    await flush();

    const edited = cachedList()?.tasks.find((item) => item.id === before.id);
    expect(edited?.name).toBe("Water the ferns");
    expect(edited?.fileName).toBe("Water the ferns.md");
    expect(edited?.body).toBe("\nNew body.\n");
    // The save keeps the frontmatter the row already had.
    expect(edited?.data?.kind).toBe("[[tasks]]");
    expect(edited?.data?.created).toBeDefined();
    expect(edited?.data?.due).toBe("2026-10-30");
    expect(edited?.data?.lists).toEqual(["[[Focus]]"]);
    expect(edited?.data?.reminders).toEqual(["2026-10-30T09:00"]);
    expect(latest!.lastError).toBeNull();
    // The rename is a new note in the vault, and the old one is gone.
    expect(vault.hooks.read("Tasks/Water the ferns.md")).toBe(edited?.text);
    expect(vault.hooks.read("Tasks/Water the plants.md")).toBeNull();
    // A write never reads the vault again.
    expect(loadCalls).toBe(1);
  });
});

describe("recurring completion", () => {
  it("completes the occurrence and creates the next note", async () => {
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();

    await act(async () => {
      await latest!.toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(creates).toHaveLength(1);
    expect(creates[0].fileName).toBe("Water plants 2026-10-27.md");
    expect(creates[0].content).toContain("title: Water plants");
    expect(creates[0].content).toContain(
      'recurrence previous: "[[Water plants]]"',
    );
    expect(creates[0].content).toContain("due: 2026-10-27");

    const old = byFile("Water plants.md");
    expect(old.data?.completed).toBeDefined();
    expect(old.data?.due).toBe("2026-10-20");
    expect(latest!.tasks.map((item) => item.fileName)).toContain(
      "Water plants 2026-10-27.md",
    );
    expect(writes.at(-1)?.text).toContain("completed:");
  });

  it("leaves the old note open when the new note cannot be created", async () => {
    createFails = true;
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();

    await act(async () => {
      await latest!.toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(writes).toHaveLength(0);
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    expect(latest!.lastError).toContain("recurring create");
  });

  it("takes the new note back when the completion write fails", async () => {
    failWrite = true;
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();

    await act(async () => {
      await latest!.toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(deletes).toEqual([SPAWN_URI]);
    expect(vault.hooks.read(`Tasks/${SPAWN_FILE}`)).toBeNull();
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    expect(latest!.tasks.map((item) => item.fileName)).not.toContain(
      "Water plants 2026-10-27.md",
    );
    expect(latest!.lastError).toContain("recurring complete");
  });

  it("takes back an untouched successor when the occurrence reopens", async () => {
    vault.hooks.write(
      "Tasks/Water plants.md",
      recurring("2026-10-20", "2026-10-24"),
    );
    vault.hooks.write(`Tasks/${SPAWN_FILE}`, spawnOf());
    await mount();

    await act(async () => {
      await latest!.toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(deletes).toEqual([SPAWN_URI]);
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    expect(latest!.tasks.map((item) => item.fileName)).not.toContain(
      "Water plants 2026-10-27.md",
    );
  });

  it("leaves an edited successor alone when the occurrence reopens", async () => {
    vault.hooks.write(
      "Tasks/Water plants.md",
      recurring("2026-10-20", "2026-10-24"),
    );
    vault.hooks.write(`Tasks/${SPAWN_FILE}`, spawnOf("\nEdited.\n"));
    await mount();

    await act(async () => {
      await latest!.toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(deletes).toEqual([]);
    expect(byFile(SPAWN_FILE)).toBeDefined();
    expect(vault.hooks.read(`Tasks/${SPAWN_FILE}`)).toContain("Edited.");
    expect(latest!.lastError).toContain("edited");
  });
});
