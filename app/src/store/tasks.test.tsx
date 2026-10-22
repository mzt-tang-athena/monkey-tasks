import * as React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
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

import { TasksProvider, useTasks, type TaskStore } from "./tasks";
import type { TaskItem } from "../features/tasks/query";

let latest: TaskStore | null = null;

function Probe() {
  latest = useTasks();
  return null;
}

async function mount(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(
      <TasksProvider>
        <Probe />
      </TasksProvider>,
    );
  });
  // Boot: saved uri, then the load.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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
});

describe("TasksProvider", () => {
  it("ticks the row before the write lands, and does not read the vault", async () => {
    await mount();
    expect(loadCalls).toBe(1);
    holdWrites = true;

    await act(async () => {
      void latest!.toggle(row());
    });

    // The write is still pending, and the row is already done.
    expect(writes).toHaveLength(1);
    expect(row().data?.completed).toBeDefined();
    expect(row().text).toContain("completed:");
    // No reload: the vault read count did not move.
    expect(loadCalls).toBe(1);

    await act(async () => {
      releaseWrite?.();
      await Promise.resolve();
    });
    expect(loadCalls).toBe(1);
  });

  it("chains two quick taps on one note", async () => {
    await mount();
    holdWrites = true;

    await act(async () => {
      void latest!.toggle(row());
      void latest!.toggle(row());
    });
    // The row already shows the second tap's result.
    expect(row().data?.completed).toBeUndefined();
    // Writes to one note are serialized: the second waits its turn.
    expect(writes).toHaveLength(1);

    await act(async () => {
      releaseWrite?.();
      await Promise.resolve();
      await Promise.resolve();
    });
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

    expect(latest!.tasks.length).toBe(before + 1);
    const captured = latest!.tasks.find((item) => item.name === "Water plants");
    expect(captured?.uri).toBe("content://vault/Tasks/New.md");
    // A capture still reads no notes: only the boot load happened.
    expect(loadCalls).toBe(1);
  });
});
