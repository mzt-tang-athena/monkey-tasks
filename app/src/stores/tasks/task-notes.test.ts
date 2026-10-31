import { describe, expect, it } from "vitest";
import { MEMORY_ROOT, createMemoryVault } from "@/lib/vault/adapters/memory";
import { loadTasks } from "./task-notes";

// The test pins what a broken task note keeps: its row, its file name,
// and the errors that explain why it cannot render as a task.

const dir = `${MEMORY_ROOT}/Tasks`;

const valid =
  '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nlists:\n  - "[[Focus]]"\n---\n\nBody.\n';
const broken = '---\nkind: "[[tasks]]"\n---\n\nNo created date.\n';

describe("loadTasks", () => {
  it("keeps a broken note with its errors instead of dropping it", async () => {
    const vault = createMemoryVault({
      "Tasks/Broken.md": broken,
      "Tasks/Valid.md": valid,
    });

    const tasks = await loadTasks(vault, dir);

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

  it("shows a spawned occurrence by its title, not its file name", async () => {
    const vault = createMemoryVault({
      "Tasks/Water plants 2026-10-27.md":
        '---\nkind: "[[tasks]]"\ncreated: 2026-10-24\ntitle: Water plants\ndue: 2026-10-27\n---\n\nBody.\n',
    });

    const tasks = await loadTasks(vault, dir);

    expect(tasks[0].name).toBe("Water plants");
    expect(tasks[0].fileName).toBe("Water plants 2026-10-27.md");
  });

  it("reads only the notes in the folder, not its subfolders or other files", async () => {
    const vault = createMemoryVault({
      "Tasks/Valid.md": valid,
      "Tasks/Lists/Focus.md": '---\nkind: "[[lists]]"\ncreated: 2026-10-20\n---\n',
      "Tasks/photo.png": "not a note",
    });

    const tasks = await loadTasks(vault, dir);

    expect(tasks.map((task) => task.fileName)).toEqual(["Valid.md"]);
  });

  it("drops a note it cannot read and keeps the rest", async () => {
    const vault = createMemoryVault({
      "Tasks/Locked.md": valid,
      "Tasks/Valid.md": valid,
    });
    vault.hooks.failNext("read", "Locked.md");

    const tasks = await loadTasks(vault, dir);

    expect(tasks.map((task) => task.fileName)).toEqual(["Valid.md"]);
  });
});
