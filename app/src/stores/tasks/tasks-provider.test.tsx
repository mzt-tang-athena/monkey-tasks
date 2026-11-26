/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the provider's hooks through
// module bindings, which is the shape the rule forbids in app code.
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertRing } from "@/lib/alerts/rings";

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
/** Fail the remove of this file name alone. */
let deleteFailsOn: string | null = null;
let renameOnCreate = false;
const creates: { fileName: string; content: string }[] = [];
const deletes: string[] = [];

vi.mock("react-native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-native")>()),
  Platform: {
    get OS() {
      return "android";
    },
    select: (options: Record<string, unknown>) =>
      options.android ?? options.default,
  },
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

// The row cache lives in app files, which a node test has none of. It
// is held here instead, and the tests read what the store wrote.
const cacheStore = vi.hoisted(() => ({
  rows: null as unknown as CachedRows | null,
  cleared: 0,
}));
vi.mock("./row-cache", () => ({
  readCachedRows: () => cacheStore.rows,
  clearCachedRows: () => {
    cacheStore.cleared += 1;
  },
  MAX_CACHED_ROWS: 200,
}));


// The alarm code runs for real on a fake OS that keeps a list of the
// alarms it holds.
const os = vi.hoisted(() => ({ alarms: new Map<string, AlertRing>() }));
vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: async () => true,
  ensureChannels: async () => undefined,
  scheduleRing: async (ring: AlertRing) => {
    os.alarms.set(ring.id, ring);
    return ring.id;
  },
  cancelScheduled: async (id: string) => {
    os.alarms.delete(id);
  },
  listScheduledDetailed: async () =>
    [...os.alarms.values()].map((ring) => ({
      id: ring.id,
      data: { uri: ring.uri, base: ring.base, weight: ring.weight },
    })),
  listDeliveredDetailed: async () => [],
  dismissDelivered: async () => undefined,
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
import type { CachedRows } from "./row-cache";
import type { TaskListData } from "./query";
import type { TaskItem } from "@/types/task";
import { spawnContent } from "./spawn";
import type { VaultFailure } from "./use-vault-failures";

const TASKS = `${MEMORY_ROOT}/Tasks`;
const CALL_TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nBody.\n';
const FOCUS_TEXT = '---\nkind: "[[lists]]"\ncreated: 2026-10-20\n---\n';

/** A done task note, for the clear tests. */
const DONE_TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\ncompleted: 2026-10-25\n---\n\nBody.\n';

/** The same note after another app removed its completion line. */
const REOPENED_TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nBody.\n';

/** Three done notes beside the open Call note. */
function doneVault(): VaultSeed {
  return {
    "Tasks/Call.md": CALL_TEXT,
    "Tasks/Buy stamps.md": DONE_TEXT,
    "Tasks/Fix bike light.md": DONE_TEXT,
    "Tasks/Water the fern.md": DONE_TEXT,
    "Tasks/Lists/Focus.md": FOCUS_TEXT,
  };
}

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
      if (deleteFails || (deleteFailsOn != null && uri.endsWith(deleteFailsOn))) {
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
      list: null,
      reminders: [],
      alertWeight: "quiet",
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
  deleteFailsOn = null;
  renameOnCreate = false;
  creates.length = 0;
  deletes.length = 0;
  os.alarms.clear();
  latest = null;
  queryClient = null;
  cacheStore.rows = null;
  cacheStore.cleared = 0;
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

  it("writes the local day and minute a task was ticked", async () => {
    await mount();
    const before = todayIso();

    await act(async () => {
      await store().toggle(row());
    });
    await flush();

    // A tick that crosses midnight in this process may land either day.
    const after = todayIso();
    const stamped = row().data?.completed;
    expect(stamped).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect([before, after]).toContain(stamped?.slice(0, 10));
    expect(writes.at(-1)?.text).toContain(`completed: ${stamped}`);
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
        list: "Focus",
        reminders: [],
        alertWeight: "harsh",
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
          list: null,
          reminders: [],
          alertWeight: "harsh",
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
        list: "Focus",
        reminders: ["2026-10-30T09:00"],
        alertWeight: before.data?.["alert weight"] ?? "harsh",
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
    expect(edited?.data?.list).toBe("[[Focus]]");
    expect(edited?.data?.reminders).toEqual(["2026-10-30T09:00"]);
    expect(failures()).toEqual([]);
    // The rename is a new note in the vault, and the old one is gone.
    expect(vault.hooks.read("Tasks/Water the ferns.md")).toBe(edited?.text);
    expect(vault.hooks.read("Tasks/Water the plants.md")).toBeNull();
    // A write never reads the vault again.
    expect(loadCalls).toBe(1);
  });
});

describe("delete and Undo", () => {
  const REMINDED_TEXT =
    '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nreminders:\n  - 2099-01-01T09:00\n---\n\nBody.\n';

  it("removes the note and its row, and gives the exact text for Undo", async () => {
    await mount();
    const before = row();
    let deleted: Awaited<ReturnType<StoreSnapshot["remove"]>> | undefined;

    await act(async () => {
      deleted = await store().remove(before);
    });
    await flush();

    expect(vault.hooks.read("Tasks/Call.md")).toBeNull();
    expect(store().tasks.map((item) => item.fileName)).toEqual([]);
    expect(deleted?.text).toBe(CALL_TEXT);
    expect(failures()).toEqual([]);
  });

  it("puts the row back when the remove fails", async () => {
    await mount();
    const before = row();
    deleteFails = true;

    await act(async () => {
      await expect(store().remove(before)).rejects.toThrow("locked");
    });
    await flush();

    expect(row().text).toBe(CALL_TEXT);
    expect(vault.hooks.read("Tasks/Call.md")).toBe(CALL_TEXT);
  });

  it("writes the exact text back to the same path on Undo", async () => {
    await mount();
    const before = row();

    await act(async () => {
      const deleted = await store().remove(before);
      await store().restore(deleted);
    });
    await flush();

    expect(vault.hooks.read("Tasks/Call.md")).toBe(CALL_TEXT);
    expect(row().id).toBe(before.id);
    expect(row().uri).toBe(before.uri);
    expect(row().text).toBe(CALL_TEXT);
  });

  it("takes the row away again when the restore fails", async () => {
    await mount();
    const before = row();
    let deleted: Awaited<ReturnType<StoreSnapshot["remove"]>> | undefined;
    await act(async () => {
      deleted = await store().remove(before);
    });
    createFails = true;

    await act(async () => {
      await expect(store().restore(deleted!)).rejects.toThrow("no space");
    });
    await flush();

    expect(store().tasks).toEqual([]);
    expect(vault.hooks.read("Tasks/Call.md")).toBeNull();
  });

  it("cancels a deleted task's alarm and rings it again after Undo", async () => {
    await mount({ "Tasks/Call.md": REMINDED_TEXT });
    // The first read schedules the reminder.
    await act(async () => {
      await store().edit(row(), {
        name: "Call",
        due: null,
        recurrence: null,
        list: null,
        reminders: ["2099-01-02T09:00"],
        alertWeight: "harsh",
        body: "\nBody.\n",
      });
    });
    await flush();
    const ringing = () =>
      [...os.alarms.values()].map((ring) => ring.base);
    expect(ringing()).toEqual([new Date(2099, 0, 2, 9, 0).getTime()]);

    let deleted: Awaited<ReturnType<StoreSnapshot["remove"]>> | undefined;
    await act(async () => {
      deleted = await store().remove(row());
    });
    await flush();
    expect(ringing()).toEqual([]);

    await act(async () => {
      await store().restore(deleted!);
    });
    await flush();
    expect(ringing()).toEqual([new Date(2099, 0, 2, 9, 0).getTime()]);
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

  it("deletes exactly the done notes it was handed, then reads the vault", async () => {
    await mount(doneVault());
    const before = loadCalls;

    await act(async () => {
      await store().clear([byFile("Buy stamps.md"), byFile("Water the fern.md")]);
    });
    await flush();

    expect(deletes.sort()).toEqual([
      `${TASKS}/Buy stamps.md`,
      `${TASKS}/Water the fern.md`,
    ]);
    expect(vault.hooks.read("Tasks/Buy stamps.md")).toBeNull();
    expect(vault.hooks.read("Tasks/Water the fern.md")).toBeNull();
    expect(vault.hooks.read("Tasks/Fix bike light.md")).not.toBeNull();
    expect(store().tasks.map((item) => item.fileName).sort()).toEqual([
      "Call.md",
      "Fix bike light.md",
    ]);
    expect(loadCalls).toBe(before + 1);
    expect(failures()).toEqual([]);
  });

  it("puts back the notes that stayed and names how many", async () => {
    await mount(doneVault());
    deleteFailsOn = "Fix bike light.md";

    await act(async () => {
      await store().clear([
        byFile("Buy stamps.md"),
        byFile("Fix bike light.md"),
        byFile("Water the fern.md"),
      ]);
    });
    await flush();

    expect(deletes.sort()).toEqual([
      `${TASKS}/Buy stamps.md`,
      `${TASKS}/Water the fern.md`,
    ]);
    expect(byFile("Fix bike light.md")).toBeDefined();
    expect(store().tasks.map((item) => item.fileName).sort()).toEqual([
      "Call.md",
      "Fix bike light.md",
    ]);
    const [notice] = store().failures;
    expect(notice.kind).toBe("notice");
    expect(notice.message).toContain("1 of 3 completed tasks stayed");
  });

  it("rolls back a clear that deleted nothing and lists a retry", async () => {
    await mount(doneVault());
    deleteFails = true;

    await act(async () => {
      await store().clear([byFile("Buy stamps.md"), byFile("Fix bike light.md")]);
    });
    await flush();

    expect(deletes).toEqual([]);
    expect(store().tasks.map((item) => item.fileName).sort()).toEqual([
      "Buy stamps.md",
      "Call.md",
      "Fix bike light.md",
      "Water the fern.md",
    ]);
    expect(failures()).toEqual([
      "clear completed: 2 of 2 completed tasks stayed: locked",
    ]);
  });

  it("keeps a note another app reopened while the confirmation was up", async () => {
    await mount(doneVault());
    // The sheet froze three done rows. Another app reopens one of them.
    vault.hooks.write("Tasks/Fix bike light.md", REOPENED_TEXT);

    await act(async () => {
      await store().clear([
        byFile("Buy stamps.md"),
        byFile("Fix bike light.md"),
        byFile("Water the fern.md"),
      ]);
    });
    await flush();

    expect(deletes.sort()).toEqual([
      `${TASKS}/Buy stamps.md`,
      `${TASKS}/Water the fern.md`,
    ]);
    expect(vault.hooks.read("Tasks/Buy stamps.md")).toBeNull();
    expect(vault.hooks.read("Tasks/Water the fern.md")).toBeNull();
    expect(vault.hooks.read("Tasks/Fix bike light.md")).toBe(REOPENED_TEXT);
    expect(byFile("Fix bike light.md").data?.completed).toBeUndefined();
    const [notice] = store().failures;
    expect(notice.kind).toBe("notice");
    expect(notice.message).toBe("1 of 3 completed tasks stayed: it was reopened");
  });

  it("reports a clear whose notes were all reopened as a notice, not a retry", async () => {
    await mount(doneVault());
    vault.hooks.write("Tasks/Buy stamps.md", REOPENED_TEXT);

    await act(async () => {
      await store().clear([byFile("Buy stamps.md")]);
    });
    await flush();

    expect(deletes).toEqual([]);
    expect(vault.hooks.read("Tasks/Buy stamps.md")).toBe(REOPENED_TEXT);
    const [notice] = store().failures;
    expect(notice.kind).toBe("notice");
    expect(notice.message).toBe("1 of 1 completed tasks stayed: it was reopened");
  });

  it("keeps a note that left the vault while the confirmation was up", async () => {
    await mount(doneVault());
    // Obsidian deletes or moves the note, so its read now fails.
    const seed = doneVault();
    delete seed["Tasks/Fix bike light.md"];
    vault.hooks.reset(seed);

    await act(async () => {
      await store().clear([
        byFile("Buy stamps.md"),
        byFile("Fix bike light.md"),
        byFile("Water the fern.md"),
      ]);
    });
    await flush();

    expect(deletes.sort()).toEqual([
      `${TASKS}/Buy stamps.md`,
      `${TASKS}/Water the fern.md`,
    ]);
    expect(vault.hooks.read("Tasks/Fix bike light.md")).toBeNull();
    const [notice] = store().failures;
    expect(notice.kind).toBe("notice");
    expect(notice.message).toBe(
      "1 of 3 completed tasks stayed: its note is missing or unreadable",
    );
  });
});

describe("deeds", () => {
  const DEED_TEXT = [
    "---",
    'kind: "[[deeds]]"',
    'status: "[[active]]"',
    "created: 2026-09-12",
    "due: 2026-10-28",
    'parent deed: "[[Garden]]"',
    "categories:",
    '  - "[[digital]]"',
    "types:",
    '  - "[[project]]"',
    'after: "[[Order things]]"',
    "---",
    "",
    "Water the beds.",
    "",
  ].join("\n");

  /** A deed note with no status: a reference note until the vault tidy. */
  const REFERENCE_TEXT = [
    "---",
    'kind: "[[deeds]]"',
    'parent deed: "[[Garden]]"',
    "---",
    "",
    "Ideas that wait.",
    "",
  ].join("\n");

  const DEED = "Deeds/Water the beds.md";

  async function mountDeeds(): Promise<void> {
    await mount({
      "Tasks/Call.md": CALL_TEXT,
      "Deeds/Water the beds.md": DEED_TEXT,
      "Deeds/Brainstorm.md": REFERENCE_TEXT,
    });
  }

  it("keeps a deed with no status out of the rows", async () => {
    await mountDeeds();

    expect(store().tasks.map((task) => task.name)).toEqual([
      "Call",
      "Water the beds",
    ]);
    expect(byName("Water the beds").folder).toBe("deeds");
    expect(byName("Water the beds").data?.status).toBe("[[active]]");
  });

  it("ticks a deed done, then reopens it as active", async () => {
    await mountDeeds();
    const deed = byName("Water the beds");

    await act(async () => {
      await store().toggle(deed);
    });
    await flush();

    const done = vault.hooks.read(DEED) as string;
    expect(done).toContain('status: "[[done]]"');
    expect(done).toMatch(/^completed: /m);
    expect(byName("Water the beds").data?.status).toBe("[[done]]");

    await act(async () => {
      await store().toggle(byName("Water the beds"));
    });
    await flush();

    const reopened = vault.hooks.read(DEED) as string;
    expect(reopened).toContain('status: "[[active]]"');
    expect(reopened).not.toContain("completed:");
  });

  it("reopens a someday deed as active, not backlog", async () => {
    await mount({
      [DEED]: DEED_TEXT.replace("[[active]]", "[[someday]]"),
    });

    await act(async () => {
      await store().toggle(byName("Water the beds"));
    });
    await flush();
    expect(vault.hooks.read(DEED)).toContain('status: "[[done]]"');

    await act(async () => {
      await store().toggle(byName("Water the beds"));
    });
    await flush();

    const reopened = vault.hooks.read(DEED) as string;
    expect(reopened).toContain('status: "[[active]]"');
    expect(reopened).not.toContain("someday");
    expect(reopened).not.toContain("backlog");
  });

  it("shows the reopened deed as active before the write lands", async () => {
    await mountDeeds();
    await act(async () => {
      await store().toggle(byName("Water the beds"));
    });
    await flush();
    holdWrites = true;

    await act(async () => {
      void store().toggle(byName("Water the beds"));
    });
    await flush();

    expect(byName("Water the beds").data?.status).toBe("[[active]]");
    expect(byName("Water the beds").data?.completed).toBeUndefined();

    await release();
  });

  it("reopens a plain task without giving it a status", async () => {
    await mountDeeds();

    await act(async () => {
      await store().toggle(byName("Call"));
    });
    await flush();
    await act(async () => {
      await store().toggle(byName("Call"));
    });
    await flush();

    const reopened = vault.hooks.read("Tasks/Call.md") as string;
    expect(reopened).not.toContain("status:");
    expect(reopened).not.toContain("completed:");
  });

  it("writes the task kind on a deed edit and keeps every other property", async () => {
    await mountDeeds();
    const deed = byName("Water the beds");

    await act(async () => {
      await store().edit(deed, {
        name: "Water the beds",
        due: "2026-10-28",
        recurrence: null,
        list: null,
        reminders: [],
        alertWeight: "harsh",
        body: "Watered.\n",
      });
    });
    await flush();

    const written = vault.hooks.read(DEED) as string;
    expect(failures()).toEqual([]);
    expect(written).toContain('kind: "[[tasks]]"');
    expect(written).toContain('parent deed: "[[Garden]]"');
    expect(written).toContain('categories:\n  - "[[digital]]"');
    expect(written).toContain('types:\n  - "[[project]]"');
    expect(written).toContain('after: "[[Order things]]"');
    expect(written).toContain("Watered.");
    // The note keeps its place and its status.
    expect(vault.hooks.read(DEED)).not.toBeNull();
    expect(byName("Water the beds").data?.status).toBe("[[active]]");
  });
});
describe("the cached first frame (ADR 20261126-a-cached-first-frame)", () => {
  const cachedNote: TaskItem = {
    id: `content://vault/Tasks/From last time.md`,
    uri: `content://vault/Tasks/From last time.md`,
    fileName: "From last time.md",
    name: "From last time",
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20", "alert weight": "harsh" },
    body: "",
  };

  function cachedRows(tab = "Main"): CachedRows {
    return {
      version: 1,
      root: MEMORY_ROOT,
      tasksDir: TASKS,
      tab,
      tasks: [cachedNote],
      lists: [{ name: "Focus", uri: `${TASKS}/Lists/Focus.md` }],
      brokenLists: [],
    };
  }

  it("draws last session's rows while the read runs, and the read replaces them", async () => {
    cacheStore.rows = cachedRows();
    const gate = Promise.withResolvers<void>();
    loadGate = gate.promise;

    await mount();

    // The read is still open, and the rows on screen are the cache's.
    expect(store().status).toBe("ready");
    expect(store().stale).toBe(true);
    expect(store().tasks.map((task) => task.name)).toEqual(["From last time"]);

    loadGate = null;
    gate.resolve();
    await flush();

    // The read wins, in full: the cached row is gone from the store.
    expect(store().stale).toBe(false);
    expect(store().tasks.map((task) => task.name)).toEqual(["Call"]);
  });

  /** A vault whose Today tab has a row, so the write path keeps the cache. */
  function dueVault(): VaultSeed {
    return {
      "Tasks/Due today.md": `---\nkind: "[[tasks]]"\ncreated: 2026-10-20\ndue: ${todayIso()}\n---\n\nBody.\n`,
      "Tasks/Lists/Focus.md": FOCUS_TEXT,
    };
  }

  it("drops rows from another grant instead of drawing them", async () => {
    cacheStore.rows = { ...cachedRows(), root: "content://tree/another-vault" };

    await mount(dueVault());
    await flush();

    expect(cacheStore.cleared).toBe(1);
    // The vault's own row is what shows, never the cache's.
    expect(store().tasks.map((task) => task.name)).toEqual(["Due today"]);
    expect(store().stale).toBe(false);
  });

  it("drops rows when the Tasks folder has moved", async () => {
    cacheStore.rows = { ...cachedRows(), tasksDir: `${MEMORY_ROOT}/Old Tasks` };

    await mount(dueVault());
    await flush();

    expect(cacheStore.cleared).toBe(1);
  });
});
