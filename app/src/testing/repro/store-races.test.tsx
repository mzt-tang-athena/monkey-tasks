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
// browser preview findings belong to ticket 0051 (vault adapter). Ticket
// 0052 deletes the actions context these tests drive, so it rewrites
// them against the new mutation hooks first.

import * as React from "react";
import {
  QueryClientProvider,
  focusManager,
  type QueryClient,
} from "@tanstack/react-query";
import { act, create } from "react-test-renderer";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** The fake folder: file uri to file text. */
const disk = new Map<string, string>();
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
let savedUri: string | null = "content://vault";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

vi.mock("@/lib/vault/grant", () => ({
  getSavedVaultUri: async () => savedUri,
  requestVaultAccess: async () => savedUri,
}));

vi.mock("@/stores/tasks/load-vault", async () => {
  const { taskFromText } = await import("@/stores/tasks/task-notes");
  return {
    // A real scan lists the folder and reads the notes first, then
    // returns. The snapshot is taken at the start for the same reason.
    loadVaultTasks: async () => {
      const snapshot = [...disk.entries()];
      const gate = loadGates.shift();
      if (gate) {
        await gate;
      }
      return {
        tasksDir: "content://vault/Tasks",
        lists: [],
        broken: [],
        tasks: snapshot.map(([uri, text]) => {
          const fileName = decodeURIComponent(uri.split("/").pop() ?? uri);
          return taskFromText(
            { id: uri, uri, fileName, name: fileName.replace(/\.md$/, "") },
            text,
          );
        }),
      };
    },
  };
});

vi.mock("@/lib/vault/notes", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/vault/notes")>();
  const hold = async () => {
    if (holdWrites > 0) {
      holdWrites -= 1;
      const gate = Promise.withResolvers<void>();
      held.push(gate.resolve);
      await gate.promise;
    }
  };
  return {
    ...actual,
    readNote: async (uri: string) => {
      const text = disk.get(uri);
      if (text == null) {
        throw new Error("no such file");
      }
      return text;
    },
    writeNote: async (uri: string, text: string) => {
      await hold();
      disk.set(uri, text);
    },
    writeNoteIfUnchanged: async (
      uri: string,
      expected: string,
      next: string,
    ) => {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error("disk full");
      }
      if (disk.get(uri) !== expected) {
        throw new actual.NoteChangedError(uri);
      }
      await hold();
      disk.set(uri, next);
    },
    // Like a document provider: the name is taken at once, and a taken
    // name gets " (1)".
    createNote: async (_folder: string, fileName: string, content: string) => {
      createCalls += 1;
      let name = fileName;
      for (
        let n = 1;
        disk.has(`content://vault/Tasks/${encodeURIComponent(name)}`);
        n += 1
      ) {
        name = fileName.replace(/\.md$/, ` (${n}).md`);
      }
      const uri = `content://vault/Tasks/${encodeURIComponent(name)}`;
      disk.set(uri, "");
      await hold();
      disk.set(uri, content);
      return { uri, fileName: name, text: content };
    },
    deleteNote: async (uri: string) => {
      if (deleteFails) {
        throw new Error("locked");
      }
      disk.delete(uri);
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
  await act(async () => {
    create(
      <QueryClientProvider client={owned}>
        <TasksProvider>
          <Probe />
        </TasksProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
}

/** The browser preview with no folder: the sample set, after its timer. */
async function mountPreview(): Promise<void> {
  savedUri = null;
  (Platform as { OS: string }).OS = "web";
  await mount();
  await wait(300);
  await flush();
}

const CALL = "content://vault/Tasks/Call.md";
const CALL_TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';
const WATER = "content://vault/Tasks/Water.md";
const WATER_TEXT =
  '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\ndue: 2026-10-20\nrecurrence: FREQ=WEEKLY\n---\n';

beforeEach(() => {
  disk.clear();
  disk.set(CALL, CALL_TEXT);
  loadGates.length = 0;
  holdWrites = 0;
  failNextWrite = false;
  deleteFails = false;
  createCalls = 0;
  fullSyncs = 0;
  savedUri = "content://vault";
  (Platform as { OS: string }).OS = "android";
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
    const key = ["tasks", "content://vault"];
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
      id: "content://vault/Tasks/Obsidian.md",
      uri: "content://vault/Tasks/Obsidian.md",
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
    disk.set("content://vault/Tasks/Bread.md", CALL_TEXT);
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
      disk.set(`content://vault/Tasks/${name}.md`, CALL_TEXT);
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
  // Finding 12. refetch() ignores `enabled: false`, so pull to refresh on
  // a phone with no folder fills the list with the sample set.
  it.fails("keeps a phone with no folder empty after a refresh", async () => {
    savedUri = null;
    await mount();
    await act(async () => {
      await store().refresh();
    });
    await wait(300);
    await flush();
    expect(store().tasks).toHaveLength(0);
  });

  // Finding 13. The sample query refetches on focus and rebuilds the
  // set, so a tab switch loses every preview change.
  it.fails("keeps preview changes across a browser focus", async () => {
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

  // Finding 14. lib/mock.ts stores the sample rule with an "RRULE:"
  // prefix, which fails the schema, so a no-op edit breaks the note.
  it.fails("keeps the recurring sample valid after a no-op edit", async () => {
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
});
