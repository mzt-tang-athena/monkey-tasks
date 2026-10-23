import { describe, expect, it, vi } from "vitest";

vi.mock("./scan", () => ({
  ensureSubfolder: vi.fn(
    async (root: string, name: string) => `${root}/${name}`,
  ),
}));

vi.mock("../tasks/query", () => ({
  loadTasks: vi.fn(async () => []),
}));

vi.mock("../lists/query", () => ({
  loadLists: vi.fn(async () => []),
}));

import { loadLists } from "../lists/query";
import { loadTasks } from "../tasks/query";
import { ensureSubfolder } from "./scan";
import { loadVaultTasks } from "./session";

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
  });
});
