/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the provider's hooks through
// module bindings, which is the shape the rule forbids in app code.
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { act, create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { Platform } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The store's contract after ADR 0017: a tap changes the row before any
// file I/O, and the vault is not read again. The mocks count both.

const writes: { uri: string; text: string }[] = [];
let loadCalls = 0;
let mockLoads = 0;
let savedUri: string | null = "content://vault";
let releaseWrite: (() => void) | null = null;
let holdWrites = false;
let heldOnce = false;
let failWrite = false;

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

vi.mock("../features/vault/grant", () => ({
  getSavedVaultUri: async () => savedUri,
  requestVaultAccess: async () => savedUri,
}));

vi.mock("../features/vault/session", () => ({
  loadVaultTasks: async () => {
    loadCalls += 1;
    return {
      tasksDir: "content://vault/Tasks",
      lists: [{ name: "Focus", uri: "content://vault/Tasks/Lists/Focus.md" }],
      broken: [],
      tasks: [
        {
          uri: "content://vault/Tasks/Call.md",
          fileName: "Call.md",
          name: "Call",
          text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nBody.\n',
          body: "\nBody.\n",
          data: { kind: "[[tasks]]", created: "2026-10-20" },
        },
      ],
    };
  },
}));

vi.mock("../lib/mock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/mock")>();
  return {
    ...actual,
    // Count the preview's read: an edit must not reload the sample set.
    loadMockTasks: () => {
      mockLoads += 1;
      return actual.loadMockTasks();
    },
  };
});

vi.mock("../features/vault/notes", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../features/vault/notes")>();
  return {
    ...actual,
    writeNote: async (uri: string, text: string) => {
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
    },
    createNote: async () => "content://vault/Tasks/New.md",
  };
});

vi.mock("../features/reminders/sync", () => ({
  syncReminders: async () => ({ scheduled: 0, skipped: true }),
  syncTaskReminders: async () => undefined,
}));

import { makeQueryClient } from "./query-client";
import { TasksProvider } from "./tasks";
import type { TaskListData } from "./tasks";
import { useStoreMeta, useTaskList } from "./task-state";
import type { StoreMeta } from "./task-state";
import { useTaskActions } from "./task-actions";
import type { TaskActions } from "./task-actions";
import type { TaskItem } from "../features/tasks/query";

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

async function mount(): Promise<ReactTestRenderer> {
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
        <TasksProvider>
          <Probe />
        </TasksProvider>
      </QueryClientProvider>,
    );
  });
  // Boot: the saved uri, then the vault read behind it.
  await flush();
  return renderer as unknown as ReactTestRenderer;
}

function row(): TaskItem {
  const task = latest?.tasks.find((item) => item.name === "Call");
  if (task == null) {
    throw new Error("the task is not in the store");
  }
  return task;
}

/** The store reads Platform.OS on every render, so the mock is mutable.
 * React Native types it as a fixed union; the test mock is a plain
 * object, so a named cast is the only way to switch it. */
const mockPlatform = Platform as { OS: string };

function setPlatform(os: "android" | "web"): void {
  mockPlatform.OS = os;
}

beforeEach(() => {
  writes.length = 0;
  loadCalls = 0;
  mockLoads = 0;
  savedUri = "content://vault";
  setPlatform("android");
  releaseWrite = null;
  holdWrites = false;
  heldOnce = false;
  failWrite = false;
  latest = null;
  latestActions = null;
  queryClient = null;
});

describe("TasksProvider", () => {
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
    const cached = queryClient!.getQueryData<TaskListData>([
      "tasks",
      "content://vault",
    ]);
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
    expect(captured?.uri).toBe("content://vault/Tasks/New.md");
    // A capture still reads no notes: only the boot load happened.
    expect(loadCalls).toBe(1);
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
    const cached = queryClient!.getQueryData<TaskListData>([
      "tasks",
      "content://vault",
    ]);
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

  it("edits a sample row in the browser preview without touching the vault", async () => {
    setPlatform("web");
    savedUri = null;
    await mount();
    // The preview's sample rows land on their own timer.
    await act(async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 300);
      await promise;
    });
    await flush();

    // Mock mode reads the sample set once and never reads the vault.
    expect(mockLoads).toBe(1);
    expect(loadCalls).toBe(0);
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

    const cached = queryClient!.getQueryData<TaskListData>(["mock"]);
    const edited = cached?.tasks.find((item) => item.id === before.id);
    expect(edited?.name).toBe("Water the ferns");
    expect(edited?.fileName).toBe("Water the ferns.md");
    expect(edited?.body).toBe("\nNew body.\n");
    // The in-memory save keeps the frontmatter the row already had.
    expect(edited?.data?.kind).toBe("[[tasks]]");
    expect(edited?.data?.created).toBeDefined();
    expect(edited?.data?.due).toBe("2026-10-30");
    expect(edited?.data?.lists).toEqual(["[[Focus]]"]);
    expect(edited?.data?.reminders).toEqual(["2026-10-30T09:00"]);
    expect(edited?.text).toContain("due: 2026-10-30");
    expect(latest!.lastError).toBeNull();
    // No file was written and neither read ran again.
    expect(writes).toHaveLength(0);
    expect(mockLoads).toBe(1);
    expect(loadCalls).toBe(0);
  });
});
