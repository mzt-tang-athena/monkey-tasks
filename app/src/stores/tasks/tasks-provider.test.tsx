/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the provider's hooks through
// module bindings, which is the shape the rule forbids in app code.
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The store's contract after ADR 0017 and ADR 0037: a tap changes the
// row before any file I/O, every write is a mutation in one scope, and
// the vault is not read again after a write. The store runs on a memory
// vault. A thin wrapper around it counts, holds and fails the calls,
// and the loader mock counts and holds the reads.

// Each render and update runs inside act, so React checks that none
// leaks out of it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const writes: { uri: string; text: string }[] = [];
let loadCalls = 0;
let releaseWrite: (() => void) | null = null;
let holdWrites = false;
let heldOnce = false;
let failWrite = false;
/** Fail the next write, after its hold if it has one. */
let failNext = false;
let loadGate: Promise<void> | null = null;
let createGate: Promise<void> | null = null;
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

// The alarm code runs for real on a fake OS that schedules nothing.
vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: async () => true,
  scheduleAt: async () => "alarm",
  cancelAllScheduled: async () => undefined,
  cancelScheduled: async () => undefined,
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
import { useStoreSnapshot, type StoreSnapshot } from "@/testing/store-snapshot";
import { todayIso } from "@/utils/dates";
import { TasksProvider } from "./tasks-provider";
import type { TaskListData } from "./query";
import type { TaskItem } from "@/types/task";
import { spawnContent } from "./spawn";
import type { VaultFailure } from "./use-vault-failures";

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
      if (failNext) {
        failNext = false;
        throw new Error("disk full");
      }
      return inner.write(uri, text);
    },
    async create(folderUri, fileName, text) {
      if (createGate) {
        await createGate;
      }
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

let latest: StoreSnapshot | null = null;
let queryClient: QueryClient | null = null;

function Probe() {
  latest = useStoreSnapshot();
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
async function mount(seed?: VaultSeed): Promise<void> {
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

  await act(async () => {
    render(
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
}

function store(): StoreSnapshot {
  if (latest == null) {
    throw new Error("the store has not rendered");
  }
  return latest;
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

function byName(name: string): TaskItem {
  const task = latest?.tasks.find((item) => item.name === name);
  if (task == null) {
    throw new Error(`the task ${name} is not in the store`);
  }
  return task;
}

function cachedList(): TaskListData | undefined {
  return queryClient!.getQueryData<TaskListData>(["tasks", MEMORY_ROOT]);
}

/** The failure list as "label: message" lines. */
function failures(): string[] {
  return store().failures.map((entry) => `${entry.label}: ${entry.message}`);
}

async function release(): Promise<void> {
  await act(async () => {
    releaseWrite?.();
    await Promise.resolve();
  });
  await flush();
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

/** The Water plants notes in the vault, sorted. */
function waterFiles(): string[] {
  return Object.keys(vault.hooks.files())
    .filter((path) => path.startsWith("Tasks/Water plants"))
    .sort();
}

/** The file names of the Water plants rows, sorted. */
function waterRows(tasks: TaskItem[] = store().tasks): string[] {
  return tasks
    .filter((item) => item.name === "Water plants")
    .map((item) => item.fileName)
    .sort();
}

/** Retry a listed failure, and return the rows its tap put up. */
async function retryFailure(failure: VaultFailure): Promise<TaskItem[]> {
  let shown: TaskItem[] = [];
  await act(async () => {
    if (failure.kind === "failure") {
      failure.retry();
    }
    // The retry's optimistic step ran before `retry()` returned.
    shown = cachedList()?.tasks ?? [];
  });
  await flush();
  return shown;
}

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
  failNext = false;
  loadGate = null;
  createGate = null;
  createFails = false;
  deleteFails = false;
  renameOnCreate = false;
  creates.length = 0;
  deletes.length = 0;
  latest = null;
  queryClient = null;
});

describe("TasksProvider", () => {
  it("lands a toggle whose note moved on since it was read", async () => {
    // Another app edits the note after the read. The tick reads the
    // note and applies itself to what is there, so the edit survives.
    await mount();
    vault.hooks.write(
      "Tasks/Call.md",
      '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nedited: yes\n---\n\nBody.\n',
    );

    await act(async () => {
      await store().toggle(row());
    });
    await flush();

    expect(failures()).toEqual([]);
    expect(row().data?.completed).toBeDefined();
    const last = writes[writes.length - 1];
    expect(last.text).toContain("edited: yes");
    expect(last.text).toContain("completed:");
  });

  it("ticks the row before the write lands, and does not read the vault", async () => {
    await mount();
    expect(loadCalls).toBe(1);
    const toggleBeforeTick = store().toggle;
    holdWrites = true;

    await act(async () => {
      void store().toggle(row());
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
    // The tick changed the rows, not the hook: its identity holds.
    expect(store().toggle).toBe(toggleBeforeTick);
    // No reload: the vault read count did not move.
    expect(loadCalls).toBe(1);

    await release();
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
      refreshing = store().refresh();
    });
    await flush();
    expect(loadCalls).toBe(booted + 1);

    // A write is queued and lands while that read is still open.
    await act(async () => {
      void store().toggle(row());
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

  it("chains two quick taps on one note, and lands the writes in order", async () => {
    await mount();
    holdWrites = true;

    await act(async () => {
      void store().toggle(row());
      void store().toggle(row());
    });
    await flush();
    // The row already shows the second tap's result.
    expect(row().data?.completed).toBeUndefined();
    // Writes run one at a time: the second waits its turn.
    expect(writes).toHaveLength(1);
    expect(writes[0].text).toContain("completed:");

    await release();
    expect(writes).toHaveLength(2);
    expect(writes[1].text).not.toContain("completed");
    expect(vault.hooks.read("Tasks/Call.md")).toBe(CALL_TEXT);
    expect(loadCalls).toBe(1);
  });

  it("captures a row before its file exists", async () => {
    await mount();
    const before = store().tasks.length;

    await act(async () => {
      await store().capture(
        {
          name: "Water plants",
          due: "2026-10-23",
        },
        { kind: "main" },
      );
    });
    await flush();

    expect(store().tasks.length).toBe(before + 1);
    const captured = byName("Water plants");
    expect(captured.uri).toBe(`${TASKS}/Water plants.md`);
    expect(vault.hooks.read("Tasks/Water plants.md")).toBe(captured.text);
    // A capture still reads no notes: only the boot load happened.
    expect(loadCalls).toBe(1);
  });

  it("keeps the typed name when the provider renames the file", async () => {
    renameOnCreate = true;
    await mount();

    await act(async () => {
      await store().capture(
        { name: "Water plants", due: "2026-10-23" },
        { kind: "main" },
      );
    });
    await flush();

    const captured = byName("Water plants");
    expect(captured.fileName).toBe("Water plants (1).md");
    // The row carries the text and data the file really has, so the
    // next write compares against the right bytes.
    expect(captured.text).toContain("title: Water plants");
    expect(captured.data?.title).toBe("Water plants");
  });

  it("edits the row by id and keeps the list tabs", async () => {
    await mount();
    const before = row();

    await act(async () => {
      await store().edit(before, {
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
    const editBeforeFailure = store().edit;
    failWrite = true;

    await act(async () => {
      await expect(
        store().edit(before, {
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
    // The editor shows the refusal, so the failure list stays clear.
    expect(failures()).toEqual([]);
    expect(store().edit).toBe(editBeforeFailure);
  });

  it("edits a sample row in the browser preview through the memory vault", async () => {
    await mount(sampleSeed(PREVIEW_SEEDS, todayIso()));
    // The preview reads the sample vault once.
    expect(loadCalls).toBe(1);
    const before = byName("Water the plants");

    await act(async () => {
      await store().edit(before, {
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
    expect(failures()).toEqual([]);
    // The rename is a new note in the vault, and the old one is gone.
    expect(vault.hooks.read("Tasks/Water the ferns.md")).toBe(edited?.text);
    expect(vault.hooks.read("Tasks/Water the plants.md")).toBeNull();
    // A write never reads the vault again.
    expect(loadCalls).toBe(1);
  });
});

describe("vault writes are mutations (ADR 0037)", () => {
  it("rolls back only its own row, and leaves a later tap on it alone", async () => {
    await mount({
      "Tasks/Call.md": CALL_TEXT,
      "Tasks/Bread.md": CALL_TEXT,
    });
    // The tick's write waits, then fails.
    holdWrites = true;
    failNext = true;
    await act(async () => {
      void store().toggle(row());
    });
    await flush();
    // A later tap moves the same row on, and another row is ticked.
    await act(async () => {
      void store().patch(row(), { due: "2026-11-01" });
      void store().toggle(byFile("Bread.md"));
    });
    await flush();

    await release();

    // The failed tick rolled back nothing a later tap owned: the row
    // keeps the date, and Bread keeps its tick.
    expect(row().data?.due).toBe("2026-11-01");
    expect(row().data?.completed).toBeUndefined();
    expect(byFile("Bread.md").data?.completed).toBeDefined();
    expect(vault.hooks.read("Tasks/Call.md")).toContain("due: 2026-11-01");
    expect(vault.hooks.read("Tasks/Call.md")).not.toContain("completed:");
    expect(failures()).toEqual(["tick: disk full"]);
  });

  it("makes a read that starts during a write wait for it", async () => {
    await mount();
    holdWrites = true;
    await act(async () => {
      void store().toggle(row());
    });
    await flush();

    let refreshing: Promise<void> = Promise.resolve();
    await act(async () => {
      refreshing = store().refresh();
    });
    await flush();
    // The read waits: the loader has not run.
    expect(loadCalls).toBe(1);

    await release();
    await act(async () => {
      await refreshing;
    });
    await flush();
    expect(loadCalls).toBe(2);
    // The read ran after the write, so it agrees with it.
    expect(row().data?.completed).toBeDefined();
  });

  it("runs a read the writes cancelled once, after the last write settles", async () => {
    await mount();
    const gate = Promise.withResolvers<void>();
    loadGate = gate.promise;
    await act(async () => {
      void store().refresh();
    });
    await flush();
    expect(loadCalls).toBe(2);

    // Two writes cancel the read in flight.
    holdWrites = true;
    await act(async () => {
      void store().toggle(row());
      void store().patch(row(), { due: "2026-11-01" });
    });
    await flush();
    loadGate = null;
    gate.resolve();
    await flush();
    // The writes are still pending, so nothing reads yet.
    expect(loadCalls).toBe(2);

    await release();
    // One read follows the last write, and it holds both writes.
    expect(loadCalls).toBe(3);
    expect(row().data?.completed).toBeDefined();
    expect(row().data?.due).toBe("2026-11-01");
  });

  it("shows a captured row before its file exists, and keeps its id after", async () => {
    await mount();
    const gate = Promise.withResolvers<void>();
    createGate = gate.promise;
    let capturing: Promise<void> = Promise.resolve();
    await act(async () => {
      capturing = store().capture({ name: "Milk" }, { kind: "main" });
    });
    await flush();

    const pending = byName("Milk");
    expect(pending.uri).toMatch(/^pending:\/\//);
    expect(vault.hooks.read("Tasks/Milk.md")).toBeNull();

    createGate = null;
    gate.resolve();
    await act(async () => {
      await capturing;
    });
    await flush();

    const landed = byName("Milk");
    expect(landed.id).toBe(pending.id);
    expect(landed.uri).toBe(`${TASKS}/Milk.md`);
    expect(vault.hooks.read("Tasks/Milk.md")).toBe(landed.text);
  });

  it("makes one Tasks folder for two captures in flight", async () => {
    await mount({ "Inbox/Note.md": "a note" });
    await act(async () => {
      void store().capture({ name: "Milk" }, { kind: "main" });
      void store().capture({ name: "Eggs" }, { kind: "main" });
    });
    await flush();

    expect(Object.keys(vault.hooks.files()).sort()).toEqual([
      "Inbox/Note.md",
      "Tasks/Eggs.md",
      "Tasks/Milk.md",
    ]);
  });

  it("keeps a failure listed until it is dismissed", async () => {
    await mount({
      "Tasks/Call.md": CALL_TEXT,
      "Tasks/Bread.md": CALL_TEXT,
    });
    failWrite = true;
    await act(async () => {
      await store().toggle(row());
    });
    await flush();
    expect(failures()).toEqual(["tick: disk full"]);
    expect(row().data?.completed).toBeUndefined();

    // A later write that lands leaves the failure on the list.
    failWrite = false;
    await act(async () => {
      await store().toggle(byFile("Bread.md"));
    });
    await flush();
    expect(failures()).toEqual(["tick: disk full"]);

    await act(async () => {
      store().failures[0].dismiss();
    });
    await flush();
    expect(failures()).toEqual([]);
  });

  it("retries the same write", async () => {
    await mount();
    failWrite = true;
    await act(async () => {
      await store().toggle(row());
    });
    await flush();
    const [failure] = store().failures;
    expect(failure.kind).toBe("failure");
    expect(row().data?.completed).toBeUndefined();

    failWrite = false;
    await act(async () => {
      if (failure.kind === "failure") {
        failure.retry();
      }
    });
    await flush();

    expect(failures()).toEqual([]);
    expect(row().data?.completed).toBeDefined();
    expect(vault.hooks.read("Tasks/Call.md")).toContain("completed:");
    expect(loadCalls).toBe(1);
  });
});

describe("recurring completion", () => {
  it("completes the occurrence and creates the next note", async () => {
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();

    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
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
    expect(store().tasks.map((item) => item.fileName)).toContain(
      "Water plants 2026-10-27.md",
    );
    expect(writes.at(-1)?.text).toContain("completed:");
  });

  it("leaves the old note open when the new note cannot be created", async () => {
    createFails = true;
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();

    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(writes).toHaveLength(0);
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    expect(store().tasks.map((item) => item.fileName)).not.toContain(SPAWN_FILE);
    expect(failures()).toEqual(["tick: no space"]);
  });

  it("takes the new note back when the completion write fails", async () => {
    failWrite = true;
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();

    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(deletes).toEqual([SPAWN_URI]);
    expect(vault.hooks.read(`Tasks/${SPAWN_FILE}`)).toBeNull();
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    expect(store().tasks.map((item) => item.fileName)).not.toContain(
      "Water plants 2026-10-27.md",
    );
    expect(failures()).toEqual(["tick: disk full"]);
  });

  it("makes no second next note when a stale tick is retried", async () => {
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();
    // The completion write fails, so the new note goes back.
    failNext = true;
    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();
    const [failure] = store().failures;
    expect(failure.kind).toBe("failure");

    // A second tap lands, and the failure stays listed.
    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();
    expect(vault.hooks.read(`Tasks/${SPAWN_FILE}`)).not.toBeNull();
    const writesBefore = writes.length;

    const shown = await retryFailure(failure);

    // The row already shows the tick, so the retry puts up no row.
    expect(waterRows(shown)).toEqual([SPAWN_FILE, "Water plants.md"]);
    // The note already holds the tick, so the retry writes nothing.
    expect(waterFiles()).toEqual([`Tasks/${SPAWN_FILE}`, "Tasks/Water plants.md"]);
    expect(writes).toHaveLength(writesBefore);
    expect(waterRows()).toEqual([SPAWN_FILE, "Water plants.md"]);
    expect(byFile("Water plants.md").data?.completed).toBeDefined();
    expect(failures()).toEqual([]);
  });

  it("writes nothing when a stale untick is retried", async () => {
    vault.hooks.write(
      "Tasks/Water plants.md",
      recurring("2026-10-20", "2026-10-24"),
    );
    vault.hooks.write(`Tasks/${SPAWN_FILE}`, spawnOf());
    await mount();
    failNext = true;
    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();
    const [failure] = store().failures;
    expect(failure.kind).toBe("failure");

    // A second tap lands: the note reopens, and the next note goes.
    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();
    expect(waterFiles()).toEqual(["Tasks/Water plants.md"]);
    const writesBefore = writes.length;

    await retryFailure(failure);

    expect(writes).toHaveLength(writesBefore);
    expect(waterFiles()).toEqual(["Tasks/Water plants.md"]);
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    expect(failures()).toEqual([]);
  });

  it("makes no second next note when a tick with a kept one is retried", async () => {
    vault.hooks.write("Tasks/Water plants.md", recurring("2026-10-20"));
    await mount();
    // The completion fails, and so does the delete of the new note.
    failNext = true;
    deleteFails = true;
    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();
    expect(waterRows()).toEqual([SPAWN_FILE, "Water plants.md"]);
    const [failure] = store().failures;
    expect(failure.kind).toBe("failure");

    // The retry fails too. It made no note, so it takes none back, and
    // the kept note's row stays.
    deleteFails = false;
    failNext = true;
    let shown = await retryFailure(failure);
    expect(waterRows(shown)).toEqual([SPAWN_FILE, "Water plants.md"]);
    expect(deletes).toEqual([]);
    expect(waterRows()).toEqual([SPAWN_FILE, "Water plants.md"]);
    const [again] = store().failures;
    expect(failures()).toEqual(["tick: disk full"]);

    shown = await retryFailure(again);

    // The retry completes the note and keeps the next note it has.
    expect(waterRows(shown)).toEqual([SPAWN_FILE, "Water plants.md"]);
    expect(waterFiles()).toEqual([`Tasks/${SPAWN_FILE}`, "Tasks/Water plants.md"]);
    expect(creates).toHaveLength(1);
    expect(vault.hooks.read("Tasks/Water plants.md")).toContain("completed:");
    expect(waterRows()).toEqual([SPAWN_FILE, "Water plants.md"]);
    const ids = store().tasks.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(failures()).toEqual([]);
  });

  it("takes back an untouched successor when the occurrence reopens", async () => {
    vault.hooks.write(
      "Tasks/Water plants.md",
      recurring("2026-10-20", "2026-10-24"),
    );
    vault.hooks.write(`Tasks/${SPAWN_FILE}`, spawnOf());
    await mount();

    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(deletes).toEqual([SPAWN_URI]);
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    expect(store().tasks.map((item) => item.fileName)).not.toContain(
      "Water plants 2026-10-27.md",
    );
    expect(failures()).toEqual([]);
  });

  it("leaves an edited successor alone when the occurrence reopens", async () => {
    vault.hooks.write(
      "Tasks/Water plants.md",
      recurring("2026-10-20", "2026-10-24"),
    );
    vault.hooks.write(`Tasks/${SPAWN_FILE}`, spawnOf("\nEdited.\n"));
    await mount();

    await act(async () => {
      await store().toggle(byFile("Water plants.md"));
    });
    await flush();

    expect(deletes).toEqual([]);
    expect(byFile(SPAWN_FILE)).toBeDefined();
    expect(vault.hooks.read(`Tasks/${SPAWN_FILE}`)).toContain("Edited.");
    // The reopen landed, and the list says why both notes stay.
    expect(byFile("Water plants.md").data?.completed).toBeUndefined();
    const [notice] = store().failures;
    expect(notice.kind).toBe("notice");
    expect(notice.message).toContain("edited");
  });
});
