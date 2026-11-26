import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system", async () => {
  const { sharedFakeAppFiles } = await import("@/testing/fake-app-files");
  return {
    File: sharedFakeAppFiles.File,
    Paths: { document: sharedFakeAppFiles.document },
  };
});

import { sharedFakeAppFiles } from "@/testing/fake-app-files";
import type { TaskItem } from "@/types/task";
import {
  MAX_CACHED_ROWS,
  clearCachedRows,
  parseCachedRows,
  readCachedRows,
  writeCachedRows,
} from "./row-cache";

// The cache is the open tab's rows from last session. These tests pin
// what it keeps, what it refuses, and what a bad file costs.

const CACHE = "file:///documents/monkey-tasks-rows.json";

function row(name: string): TaskItem {
  return {
    id: `content://vault/Tasks/${name}.md`,
    uri: `content://vault/Tasks/${name}.md`,
    fileName: `${name}.md`,
    name,
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20", "alert weight": "harsh" },
    body: "",
  };
}

const rows = {
  root: "content://tree/primary%3ADocuments%2Fobsidian-vault",
  tasksDir: "content://tree/primary%3ADocuments%2Fobsidian-vault/document/Tasks",
  tab: "Main",
  tasks: [row("Call"), row("Write")],
  lists: [{ name: "Focus", uri: "content://vault/Tasks/Lists/Focus.md" }],
  brokenLists: [],
};

beforeEach(() => {
  sharedFakeAppFiles.reset();
});

describe("the row cache", () => {
  it("reads back what it wrote, under the folder it came from", () => {
    writeCachedRows(rows);

    const read = readCachedRows();

    expect(read?.version).toBe(1);
    expect(read?.root).toBe(rows.root);
    expect(read?.tasksDir).toBe(rows.tasksDir);
    expect(read?.tab).toBe("Main");
    expect(read?.tasks.map((task) => task.name)).toEqual(["Call", "Write"]);
    expect(read?.lists).toEqual(rows.lists);
  });

  it("has nothing before the first write", () => {
    expect(readCachedRows()).toBeNull();
  });

  it("keeps the open tab's rows and no more", () => {
    writeCachedRows({
      ...rows,
      tasks: Array.from({ length: MAX_CACHED_ROWS + 40 }, (_, at) => row(`N${at}`)),
    });

    expect(readCachedRows()?.tasks).toHaveLength(MAX_CACHED_ROWS);
  });

  it("drops a file from another version, and one that is not JSON", () => {
    expect(parseCachedRows(JSON.stringify({ ...rows, version: 0 }))).toBeNull();
    expect(parseCachedRows("{ not json")).toBeNull();
    expect(parseCachedRows(JSON.stringify({ ...rows, tasks: [{ uri: 1 }] }))).toBeNull();
  });

  it("clears the file when the grant changes", () => {
    writeCachedRows(rows);
    clearCachedRows();

    expect(sharedFakeAppFiles.files.has(CACHE)).toBe(false);
    expect(readCachedRows()).toBeNull();
  });

  it("an unreadable file reads as no cache, never a crash", () => {
    sharedFakeAppFiles.files.set(CACHE, "\u0000\u0001");

    expect(readCachedRows()).toBeNull();
  });
});
