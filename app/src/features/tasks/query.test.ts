import { describe, expect, it, vi } from "vitest";

// The loader talks to SAF. The test pins what a broken task note keeps:
// its row, its file name, and the errors that explain why it cannot
// render as a task.
vi.mock("../vault/scan", () => ({
  listDirectory: vi.fn(),
  displayName: vi.fn((uri: string) => uri.split("/").pop() ?? uri),
}));

vi.mock("../vault/notes", () => ({
  readNote: vi.fn(),
}));

import { listDirectory } from "../vault/scan";
import { readNote } from "../vault/notes";
import { loadTasks } from "./query";

const dir = "content://root/Tasks";

function entry(name: string) {
  return { uri: `${dir}/${name}`, name, isFile: true };
}

const valid =
  '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nlists:\n  - "[[Focus]]"\n---\n\nBody.\n';
const broken = '---\nkind: "[[tasks]]"\n---\n\nNo created date.\n';

describe("loadTasks", () => {
  it("keeps a broken note with its errors instead of dropping it", async () => {
    vi.mocked(listDirectory).mockResolvedValue([
      entry("Broken.md"),
      entry("Valid.md"),
    ]);
    vi.mocked(readNote).mockImplementation(async (uri: string) =>
      uri.endsWith("Broken.md") ? broken : valid,
    );

    const tasks = await loadTasks(dir);

    const brokenRow = tasks.find((task) => task.name === "Broken");
    expect(brokenRow).toBeDefined();
    expect(brokenRow?.data).toBeNull();
    expect(brokenRow?.errors?.some((error) => error.startsWith("created:"))).toBe(
      true,
    );
    expect(brokenRow?.body).toBe("\nNo created date.\n");

    const validRow = tasks.find((task) => task.name === "Valid");
    expect(validRow?.data?.lists).toEqual(["[[Focus]]"]);
    expect(validRow?.errors).toBeUndefined();
  });
});
