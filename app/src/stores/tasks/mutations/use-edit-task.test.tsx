import * as React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEMORY_ROOT, createMemoryVault } from "@/lib/vault/adapters/memory";
import {
  loadActionFailures,
  recordActionFailure,
} from "@/lib/alerts/action-failures";
import { sharedFakeAppFiles } from "@/testing/fake-app-files";
import type { TaskEdit } from "@/types/task";
import { tasksKey, type TaskListData } from "../query";
import { taskFromText } from "../task-notes";

// A drop in the editor, as the status picker sends it. The failure a
// Didn't do press left on the same task is then moot.

const world = vi.hoisted(() => ({ cleared: [] as string[] }));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system", async () => {
  const { sharedFakeAppFiles: files } = await import("@/testing/fake-app-files");
  return { File: files.File, Paths: { document: files.document } };
});
vi.mock("@/lib/notifications", () => ({
  clearActionFailureNotice: async (id: string) => {
    world.cleared.push(id);
  },
}));
vi.mock("../reminder-sync", () => ({
  syncTaskReminders: async () => undefined,
  acknowledgeRingNow: async () => undefined,
  acknowledgeRing: async () => undefined,
  inTurn: <T,>(work: () => Promise<T>) => work(),
  reconcileTask: async () => undefined,
}));

const vault = createMemoryVault({
  "Tasks/Call Mum.md":
    '---\nkind: "[[tasks]]"\ncreated: 2026-11-20\ntitle: Call Mum\n---\nBody.\n',
});
vi.mock("@/lib/vault/vault-provider", () => ({
  useVault: () => ({ adapter: vault, root: MEMORY_ROOT }),
}));

import { useEditTask } from "./use-edit-task";

const uri = `${MEMORY_ROOT}/Tasks/Call Mum.md`;
const draft: TaskEdit = {
  name: "Call Mum",
  due: null,
  recurrence: null,
  list: null,
  reminders: [],
  alertWeight: "quiet",
  body: "Body.\n",
};

function setup() {
  const client = new QueryClient();
  const row = taskFromText(
    { id: uri, uri, fileName: "Call Mum.md", name: "Call Mum" },
    vault.hooks.read("Tasks/Call Mum.md") ?? "",
  );
  client.setQueryData<TaskListData>(tasksKey(MEMORY_ROOT), {
    tasksDir: `${MEMORY_ROOT}/Tasks`,
    tasks: [row],
    lists: [],
    broken: [],
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { row, ...renderHook(() => useEditTask(), { wrapper }) };
}

beforeEach(() => {
  world.cleared.length = 0;
  sharedFakeAppFiles.reset();
  for (const kind of ["drop", "done"] as const) {
    recordActionFailure({
      id: `${uri}|${kind}`,
      uri,
      name: "Call Mum",
      action: { kind },
      message: "disk full",
      at: 1,
    });
  }
});

describe("useEditTask", () => {
  it("clears a failed Didn't do press when the editor drops the task", async () => {
    const { row, result } = setup();

    await result.current(row, { ...draft, status: "[[dropped]]" });

    expect(loadActionFailures().map((entry) => entry.id)).toEqual([
      `${uri}|done`,
    ]);
    expect(world.cleared).toEqual([`${uri}|drop`]);
  });

  it("keeps the record when the edit is not a drop", async () => {
    const { row, result } = setup();

    await result.current(row, { ...draft, status: "[[active]]" });

    expect(loadActionFailures()).toHaveLength(2);
    expect(world.cleared).toEqual([]);
  });
});
