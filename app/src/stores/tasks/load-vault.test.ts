import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vault/scan", () => ({
  ensureSubfolder: vi.fn(
    async (root: string, name: string) => `${root}/${name}`,
  ),
}));

vi.mock("./task-notes", () => ({
  loadTasks: vi.fn(async () => []),
}));

vi.mock("./list-notes", () => ({
  loadLists: vi.fn(async () => ({ lists: [], broken: [] as BrokenList[] })),
}));

import { loadLists } from "./list-notes";
import type { BrokenList } from "@/types/task";
import { loadTasks } from "./task-notes";
import { ensureSubfolder } from "@/lib/vault/scan";
import { loadVaultTasks } from "./load-vault";

/**
 * The Tasks folder is always derived from the granted root. A reload
 * that passed the Tasks folder back in would nest a second Tasks
 * folder inside it and read an empty list.
 */
describe("loadVaultTasks", () => {
  it("derives the Tasks folder from the root and reads the notes there", async () => {
    const result = await loadVaultTasks("content://root/vault");

    expect(ensureSubfolder).toHaveBeenCalledWith("content://root/vault", "Tasks");
    expect(loadTasks).toHaveBeenCalledWith("content://root/vault/Tasks");
    expect(result.tasksDir).toBe("content://root/vault/Tasks");
  });

  it("reads the list notes from the same Tasks folder", async () => {
    const result = await loadVaultTasks("content://root/vault");

    expect(loadLists).toHaveBeenCalledWith("content://root/vault/Tasks");
    expect(result.lists).toEqual([]);
    expect(result.broken).toEqual([]);
  });

  it("passes the broken list notes through", async () => {
    const broken = {
      name: "Errands",
      uri: "content://root/vault/Tasks/Lists/Errands.md",
      errors: ["created: expected a date like 2026-10-21"],
    };
    vi.mocked(loadLists).mockResolvedValueOnce({ lists: [], broken: [broken] });

    const result = await loadVaultTasks("content://root/vault");

    expect(result.lists).toEqual([]);
    expect(result.broken).toEqual([broken]);
  });
});
