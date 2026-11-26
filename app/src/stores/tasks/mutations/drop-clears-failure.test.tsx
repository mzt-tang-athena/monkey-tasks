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

// A drop in the app, from the editor's status picker or a drag onto
// the Board's Dropped header. Both write through the shared vault
// mutation, which clears the failure a Didn't do press left on the
// same task, because that failure is then moot.

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

const held = vi.hoisted(() => ({ vault: null as unknown }));
vi.mock("@/lib/vault/vault-provider", () => ({
  useVault: () => ({ adapter: held.vault, root: "memory://vault" }),
}));

import { useEditTask } from "./use-edit-task";
import { usePatchTask } from "./use-patch-task";

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
  const vault = createMemoryVault({
    "Tasks/Call Mum.md":
      '---\nkind: "[[tasks]]"\ncreated: 2026-11-20\ntitle: Call Mum\n---\nBody.\n',
  });
  held.vault = vault;
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
  return {
    row,
    edit: renderHook(() => useEditTask(), { wrapper }).result,
    patch: renderHook(() => usePatchTask(), { wrapper }).result,
  };
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

describe("a drop in the app", () => {
  it("clears a failed Didn't do press when the editor drops the task", async () => {
    const { row, edit } = setup();

    await edit.current(row, { ...draft, status: "[[dropped]]" });

    expect(loadActionFailures().map((entry) => entry.id)).toEqual([
      `${uri}|done`,
    ]);
    expect(world.cleared).toEqual([`${uri}|drop`]);
  });

  it("clears it when a Board drag patches the status to dropped", async () => {
    const { row, patch } = setup();

    await patch.current(row, { status: "[[dropped]]" });

    expect(loadActionFailures().map((entry) => entry.id)).toEqual([
      `${uri}|done`,
    ]);
    expect(world.cleared).toEqual([`${uri}|drop`]);
  });

  it("keeps the record when the write leaves the task in another status", async () => {
    const { row, edit, patch } = setup();

    await edit.current(row, { ...draft, status: "[[active]]" });
    await patch.current(row, { status: "[[someday]]" });

    expect(loadActionFailures()).toHaveLength(2);
    expect(world.cleared).toEqual([]);
  });
});
