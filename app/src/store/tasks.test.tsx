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
// file I/O, and the vault is not read again. The mocks count both.

const writes: { uri: string; text: string }[] = [];
let loadCalls = 0;
let releaseWrite: (() => void) | null = null;
let holdWrites = false;
let heldOnce = false;

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

vi.mock("../features/vault/grant", () => ({
  getSavedVaultUri: async () => "content://vault",
  requestVaultAccess: async () => "content://vault",
}));

vi.mock("../features/vault/session", () => ({
  loadVaultTasks: async () => {
    loadCalls += 1;
    return {
      tasksDir: "content://vault/Tasks",
      lists: [],
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

vi.mock("../features/vault/notes", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../features/vault/notes")>();
  return {
    ...actual,
    writeNote: async (uri: string, text: string) => {
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

beforeEach(() => {
  writes.length = 0;
  loadCalls = 0;
  releaseWrite = null;
  holdWrites = false;
  heldOnce = false;
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
});
