/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the provider's hooks through module
// bindings, which is the shape the rule forbids in app code.

// Reproductions of the data-layer audit findings, written before the
// fixes. Each `it.fails` asserts the behaviour we want, so it passes
// today only because the bug is still there. The ticket that fixes a
// finding turns its test into a plain `it`; a fixed bug with `it.fails`
// left in place fails the suite.
//
// Store findings belong to ticket 0052 (writes become mutations). The
// browser preview findings belong to ticket 0051 (vault adapter), which
// fixed them. Ticket 0052 deletes the actions context these tests
// drive, so it rewrites them against the new mutation hooks first.
//
// The store runs on a memory vault (ADR 0037). A thin wrapper around it
// holds and fails single calls, and the loader mock gates whole reads.

import * as React from "react";
import {
  QueryClientProvider,
  focusManager,
  type QueryClient,
} from "@tanstack/react-query";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultAdapter } from "@/lib/vault/adapter";
import {
  MEMORY_ROOT,
  createMemoryVault,
  type MemoryVault,
} from "@/lib/vault/adapters/memory";
import { defaultAdapter as browserVault } from "@/lib/vault/default-adapter.web";
import { VaultProvider } from "@/lib/vault/vault-provider";
import { makeQueryClient } from "@/lib/react-query";
import { TasksProvider, type TaskListData } from "@/stores/tasks/tasks-provider";
import {
  useStoreMeta,
  useTaskList,
  type StoreMeta,
} from "@/stores/tasks/task-state";
import { useTaskActions, type TaskActions } from "@/stores/tasks/task-actions";
import type { TaskItem } from "@/types/task";
import { reorderItems } from "@/features/lists/reorder";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const TASKS = `${MEMORY_ROOT}/Tasks`;

/** The vault the store runs on. */
let vault: MemoryVault;

/** The vault's files by uri, the way the findings talk about them. */
const disk = {
  get: (uri: string) => vault.hooks.read(pathOf(uri)) ?? undefined,
  set: (uri: string, text: string) => vault.hooks.write(pathOf(uri), text),
  keys: () => Object.keys(vault.hooks.files()).map(uriOf),
  entries: () =>
    Object.entries(vault.hooks.files()).map(
      ([path, text]) => [uriOf(path), text] as const,
    ),
};

function pathOf(uri: string): string {
  return uri.slice(MEMORY_ROOT.length + 1);
}

function uriOf(path: string): string {
  return `${MEMORY_ROOT}/${path}`;
}

/** One gate per vault read, taken in order. A read with no gate runs. */
const loadGates: Promise<void>[] = [];
const openGates: (() => void)[] = [];
/** How many of the next writes or creates wait for a release. */
let holdWrites = 0;
const held: (() => void)[] = [];
let failNextWrite = false;
let deleteFails = false;
let createCalls = 0;
let fullSyncs = 0;
/** A phone with no folder granted: the vault has no saved root. */
let noFolder = false;

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

vi.mock("@/stores/tasks/load-vault", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/stores/tasks/load-vault")>();
  return {
    ...actual,
    // A real scan lists the folder and reads the notes first, then
    // returns. The read serves the files as they were when it started,
    // however long its gate holds it.
    loadVault: async (_adapter: VaultAdapter, root: string) => {
      const snapshot = createMemoryVault(vault.hooks.files());
      const gate = loadGates.shift();
      if (gate) {
        await gate;
      }
      return actual.loadVault(snapshot, root);
    },
  };
});

vi.mock("@/stores/tasks/reminder-sync", () => ({
  syncReminders: async () => {
    fullSyncs += 1;
    return { scheduled: 0, skipped: true };
  },
  syncTaskReminders: async () => undefined,
}));

async function hold(): Promise<void> {
  if (holdWrites > 0) {
    holdWrites -= 1;
    const gate = Promise.withResolvers<void>();
    held.push(gate.resolve);
    await gate.promise;
  }
}

/** The vault as the store sees it, with single calls held or failed. */
function instrumented(inner: MemoryVault): VaultAdapter {
  return {
    ...inner,
    savedRoot: async () => (noFolder ? null : inner.savedRoot()),
    async write(uri, text) {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error("disk full");
      }
      await hold();
      return inner.write(uri, text);
    },
    // Like a document provider: the name is taken at once, empty, and
    // the text lands when the write is let go.
    async create(folderUri, fileName, text) {
      createCalls += 1;
      const made = await inner.create(folderUri, fileName, "");
      await hold();
      await inner.write(made.uri, text);
      return made;
    },
    async remove(uri) {
      if (deleteFails) {
        throw new Error("locked");
      }
      return inner.remove(uri);
    },
  };
}

type Snapshot = StoreMeta & TaskActions & { tasks: TaskItem[] };

let latest: Snapshot | null = null;
let client: QueryClient | null = null;
let onRender: ((tasks: TaskItem[]) => void) | null = null;

function Probe() {
  const tasks = useTaskList();
  const meta = useStoreMeta();
  const actions = useTaskActions();
  latest = { ...meta, ...actions, tasks };
  onRender?.(tasks);
  return null;
}

function store(): Snapshot {
  if (latest == null) {
    throw new Error("the store has not rendered");
  }
  return latest;
}

function row(name = "Call"): TaskItem {
  const found = store().tasks.find((task) => task.name === name);
  if (found == null) {
    throw new Error(`the task ${name} is not in the store`);
  }
  return found;
}

function hasRow(name: string): boolean {
  return store().tasks.some((task) => task.name === name);
}

async function flush(turns = 4): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 0);
      await promise;
    }
  });
}

async function wait(ms: number): Promise<void> {
  await act(async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    await promise;
  });
}

function gateNextRead(): () => void {
  const gate = Promise.withResolvers<void>();
  loadGates.push(gate.promise);
  openGates.push(gate.resolve);
  return gate.resolve;
}

async function release(): Promise<void> {
  await act(async () => {
    held.shift()?.();
  });
  await flush();
}

async function mount(): Promise<void> {
  client = makeQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retry: false },
  });
  const owned = client;
  const adapter = instrumented(vault);
  await act(async () => {
    create(
      <QueryClientProvider client={owned}>
        <VaultProvider adapter={adapter}>
          <TasksProvider>
            <Probe />
          </TasksProvider>
        </VaultProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
}

/** The browser preview: the vault the web build makes, sample and all. */
async function mountPreview(): Promise<void> {
  vault = browserVault() as MemoryVault;
  await mount();
  await wait(300);
  await flush();
}

const CALL = `${TASKS}/Call.md`;
const CALL_TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';
const WATER = `${TASKS}/Water.md`;
const WATER_TEXT =
  '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\ndue: 2026-10-20\nrecurrence: FREQ=WEEKLY\n---\n';

beforeEach(() => {
  vault = createMemoryVault();
  disk.set(CALL, CALL_TEXT);
  loadGates.length = 0;
  holdWrites = 0;
  failNextWrite = false;
  deleteFails = false;
  createCalls = 0;
  fullSyncs = 0;
  noFolder = false;
  onRender = null;
  latest = null;
  client = null;
});

afterEach(async () => {
  // A test that stops on a failed expectation leaves work waiting. It
  // finishes inside act, so its state updates do not leak.
  await act(async () => {
    held.splice(0).forEach((resolve) => resolve());
    openGates.splice(0).forEach((resolve) => resolve());
  });
  await flush();
});

describe("store races (ticket 0052)", () => {
  // Finding 1. tasks.tsx capture: a capture never registers as a write,
  // so a read already in flight lands without the new row.
  it.fails("keeps a capture made while a read is in flight", async () => {
    await mount();
    const open = gateNextRead();
    let refreshing: Promise<void> = Promise.resolve();
    await act(async () => {
      refreshing = store().refresh();
    });
    await flush();
    await act(async () => {
      await store().capture({ name: "Milk" }, { kind: "main" });
    });
    await flush();
    open();
    await act(async () => {
      await refreshing;
    });
    await flush();
    expect(hasRow("Milk")).toBe(true);
  });

  // Finding 3. tasks.tsx toggle/spawnNext: a recurring tick waits for
  // the create before the row moves.
  it.fails("shows a recurring tick before the new note lands", async () => {
    disk.set(WATER, WATER_TEXT);
    await mount();
    holdWrites = 1;
    await act(async () => {
      void store().toggle(row("Water"));
    });
    await flush();
    expect(row("Water").data?.completed).toBeDefined();
  });

  // Finding 3. A second tap before the first lands spawns a second
  // successor, which the compensation deletes, and reports an error.
  it.fails("takes a double tap on a recurring task without an error", async () => {
    disk.set(WATER, WATER_TEXT);
    await mount();
    await act(async () => {
      const water = row("Water");
      void store().toggle(water);
      void store().toggle(water);
    });
    await flush(8);
    expect(createCalls).toBe(1);
    expect(store().lastError).toBeNull();
  });

  // Finding 4. tasks.tsx readVault: the third read attempt neither waits
  // for writes nor checks the write counter.
  it.fails("never lands a read that overlapped a write", async () => {
    await mount();
    const opens = [gateNextRead(), gateNextRead(), gateNextRead()];
    let refreshing: Promise<void> = Promise.resolve();
    await act(async () => {
      refreshing = store().refresh();
    });
    await flush();
    const dues = ["2026-11-01", "2026-11-02", "2026-11-03"];
    for (const [index, due] of dues.entries()) {
      await act(async () => {
        await store().writeFields(row(), { due });
      });
      await flush();
      opens[index]();
      await flush();
    }
    await act(async () => {
      await refreshing;
    });
    await flush();
    expect(disk.get(CALL)).toContain("due: 2026-11-03");
    expect(row().data?.due).toBe("2026-11-03");
  });

  // Finding 5. tasks.tsx toggle: the first write's result replaces the
  // row even after a second tap moved it on.
  it.fails("never shows an earlier tap over a later one", async () => {
    await mount();
    holdWrites = 2;
    await act(async () => {
      void store().toggle(row());
      void store().toggle(row());
    });
    await flush();
    const seen: boolean[] = [];
    onRender = (tasks) => {
      const call = tasks.find((task) => task.name === "Call");
      seen.push(call?.data?.completed != null);
    };
    await release();
    await release();
    expect(row().data?.completed).toBeUndefined();
    expect(seen).not.toContain(true);
  });

  // Finding 6. tasks.tsx applyTasks: a tap writes a list built from the
  // ref, which lags the cache until the effect runs.
  it.fails("keeps a read that lands just before a tap", async () => {
    await mount();
    const key = ["tasks", MEMORY_ROOT];
    const cache = client;
    if (cache == null) {
      throw new Error("no client");
    }
    const fresh = cache.getQueryData<TaskListData>(key);
    if (fresh == null) {
      throw new Error("no cached list");
    }
    const outside: TaskItem = {
      ...fresh.tasks[0],
      id: `${TASKS}/Obsidian.md`,
      uri: `${TASKS}/Obsidian.md`,
      fileName: "Obsidian.md",
      name: "Obsidian",
    };
    disk.set(outside.uri, outside.text);
    await act(async () => {
      // A read result lands, then a tap arrives before React commits.
      cache.setQueryData<TaskListData>(key, {
        ...fresh,
        tasks: [...fresh.tasks, outside],
      });
      void store().toggle(fresh.tasks[0]);
    });
    await flush();
    expect(hasRow("Obsidian")).toBe(true);
  });

  // Finding 7. tasks.tsx lastError: one string, cleared by any success.
  it.fails("keeps a failure on screen after an unrelated success", async () => {
    disk.set(`${TASKS}/Bread.md`, CALL_TEXT);
    await mount();
    failNextWrite = true;
    await act(async () => {
      await store().writeFields(row("Call"), { order: 1 });
    });
    await act(async () => {
      await store().writeFields(row("Bread"), { order: 2 });
    });
    await flush();
    expect(store().lastError).not.toBeNull();
  });

  // Finding 8. app/(tabs)/index.tsx endReorder writes one row at a time
  // and rolls back only the row that failed.
  it.fails("rolls back a whole reorder drop when one write fails", async () => {
    for (const name of ["Bread", "Eggs"]) {
      disk.set(`${TASKS}/${name}.md`, CALL_TEXT);
    }
    await mount();
    const section = [row("Bread"), row("Call"), row("Eggs")];
    // Move Eggs to the top: every row gets a new number.
    const changes = reorderItems(section, 2, 0);
    // The same loop as the Lists screen's drop handler.
    for (const [index, change] of changes.entries()) {
      failNextWrite = index === 1;
      await act(async () => {
        await store().writeFields(change.task, { order: change.order });
      });
    }
    await flush();
    const orders = ["Bread", "Call", "Eggs"].map((name) => row(name).data?.order);
    const untouched = orders.every((order) => order == null);
    const applied = orders.join(",") === "2,3,1";
    expect(untouched || applied).toBe(true);
  });

  // Finding 9. tasks.tsx capture keeps the provisional id; the next read
  // hands the row the uri as its id, so the editor loses it.
  it.fails("keeps a captured row's id across a read", async () => {
    await mount();
    await act(async () => {
      await store().capture({ name: "Milk" }, { kind: "main" });
    });
    await flush();
    const id = row("Milk").id;
    await act(async () => {
      await store().refresh();
    });
    await flush();
    expect(row("Milk").id).toBe(id);
  });

  // Finding 10. tasks.tsx toggle drops a tap on a pending row.
  it.fails("lands a tick on a row whose file is still being created", async () => {
    await mount();
    holdWrites = 1;
    let capturing: Promise<void> = Promise.resolve();
    await act(async () => {
      capturing = store().capture({ name: "Milk" }, { kind: "main" });
    });
    await flush();
    await act(async () => {
      void store().toggle(row("Milk"));
    });
    await release();
    await act(async () => {
      await capturing;
    });
    await flush();
    expect(row("Milk").data?.completed).toBeDefined();
    const file = [...disk.entries()].find(([uri]) => uri.includes("Milk"));
    expect(file?.[1]).toContain("completed:");
  });

  // Finding 17. tasks.tsx queuePatch: when the note on disk no longer
  // parses, the retry writes it back unchanged and reports success.
  it.fails("reports a tick that could not land on a broken note", async () => {
    await mount();
    disk.set(CALL, '---\nkind: "[[tasks]]"\n---\n');
    await act(async () => {
      await store().toggle(row());
    });
    await flush();
    expect(store().lastError).not.toBeNull();
  });

  // Finding 18. tasks.tsx spawnNext compensation removes the new row
  // even when its delete failed, so a live note hides.
  it.fails("keeps showing a successor whose delete failed", async () => {
    disk.set(WATER, WATER_TEXT);
    await mount();
    failNextWrite = true;
    deleteFails = true;
    await act(async () => {
      await store().toggle(row("Water"));
    });
    await flush();
    const successor = [...disk.keys()].find((uri) => uri.includes("2026-10-27"));
    expect(successor).toBeDefined();
    expect(store().tasks.some((task) => task.uri === successor)).toBe(true);
  });

  // Finding 2, store side. tasks.tsx runs the full alarm rebuild on every
  // cache change, so each tap reschedules every alarm in the vault.
  it.fails("rebuilds alarms only after a vault read", async () => {
    await mount();
    const before = fullSyncs;
    for (const due of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
      await act(async () => {
        await store().writeFields(row(), { due });
      });
      await flush();
    }
    expect(fullSyncs - before).toBe(0);
  });
});

describe("preview and empty folder (ticket 0051)", () => {
  // Finding 12. refetch() ignored `enabled: false`, so pull to refresh on
  // a phone with no folder filled the list with the sample set.
  it("keeps a phone with no folder empty after a refresh", async () => {
    noFolder = true;
    await mount();
    await act(async () => {
      await store().refresh();
    });
    await wait(300);
    await flush();
    expect(store().tasks).toHaveLength(0);
    expect(store().status).toBe("ready");
  });

  // Finding 13. The sample query refetched on focus and rebuilt the set,
  // so a tab switch lost every preview change.
  it("keeps preview changes across a browser focus", async () => {
    await mountPreview();
    await act(async () => {
      await store().capture({ name: "Preview row" }, { kind: "main" });
    });
    await flush();
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await wait(300);
    await flush();
    expect(hasRow("Preview row")).toBe(true);
  });

  // Finding 14. lib/mock.ts stored the sample rule with an "RRULE:"
  // prefix, which fails the schema, so a no-op edit broke the note.
  it("keeps the recurring sample valid after a no-op edit", async () => {
    await mountPreview();
    const sample = row("Supplements");
    await act(async () => {
      await store().edit(sample, {
        name: "Supplements",
        due: sample.data?.due ?? null,
        recurrence: sample.data?.recurrence ?? null,
        lists: [],
        reminders: [],
        body: "",
      });
    });
    await flush();
    expect(row("Supplements").data).not.toBeNull();
  });

  // The read made Tasks/ when its listing missed it, so a slow listing
  // left a second folder and an empty list.
  it("reads a vault with no Tasks folder without making one", async () => {
    vault = createMemoryVault({ "Inbox/Note.md": "a note" });
    await mount();

    expect(store().status).toBe("ready");
    expect(store().tasks).toHaveLength(0);
    expect(await vault.findFolder(MEMORY_ROOT, "Tasks")).toBeNull();
  });

  it("makes the Tasks folder with the first capture", async () => {
    vault = createMemoryVault({ "Inbox/Note.md": "a note" });
    await mount();

    await act(async () => {
      await store().capture({ name: "Milk" }, { kind: "main" });
    });
    await flush();

    expect(Object.keys(vault.hooks.files())).toEqual([
      "Inbox/Note.md",
      "Tasks/Milk.md",
    ]);
    // A tick on the new row lands: the store needs no read first.
    await act(async () => {
      await store().toggle(row("Milk"));
    });
    await flush();
    expect(store().lastError).toBeNull();
    expect(disk.get(`${TASKS}/Milk.md`)).toContain("completed:");
  });

  it("keeps a typed name with a colon after a refresh", async () => {
    await mountPreview();
    await act(async () => {
      await store().capture({ name: "Pay bill: water" }, { kind: "main" });
    });
    await act(async () => {
      await store().refresh();
    });
    await flush();

    expect(hasRow("Pay bill: water")).toBe(true);
    expect(disk.get(`${TASKS}/Pay bill water.md`)).toContain(
      'title: "Pay bill: water"',
    );
  });

  it("ticks a recurring sample into a new note for its next date", async () => {
    await mountPreview();
    await act(async () => {
      await store().toggle(row("Supplements"));
    });
    await flush();

    const next = disk
      .keys()
      .filter((uri) => uri.startsWith(`${TASKS}/Supplements `));
    expect(next).toHaveLength(1);
    expect(disk.get(next[0])).toContain(
      'recurrence previous: "[[Supplements]]"',
    );
    expect(disk.get(`${TASKS}/Supplements.md`)).toContain("completed:");
    expect(store().lastError).toBeNull();
  });
});
