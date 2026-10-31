// Reproductions of audit findings 11, 15 and 16, written before the
// fixes (ticket 0053). Each one ran as `it.fails` until its fix landed,
// and now runs as a plain `it`. The parser cases hold because ticket
// 0053 moved the contracts submodule to the parser fix.

import { describe, expect, it } from "vitest";
import { taskFrontmatter, validateNote } from "@monkey-tasks/schemas";
import { MEMORY_ROOT, createMemoryVault } from "@/lib/vault/adapters/memory";
import { createNote } from "@/lib/vault/notes";
import { updateProperty } from "@/lib/vault/frontmatter";
import { loadTasks, taskFromText } from "@/stores/tasks/task-notes";
import { saveTaskEdit } from "@/features/task-editor/save";
import { captureDraft } from "@/features/capture/write";

const TASKS = `${MEMORY_ROOT}/Tasks`;
const URI = `${TASKS}/Call.md`;

/** A task note whose Focus list item sits at the given indent. */
function withList(indent: string): string {
  return `---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nlists:\n${indent}- "[[Focus]]"\n---\n`;
}

function listsOf(text: string): string[] | null {
  return validateNote("Call.md", text, taskFrontmatter).data?.lists ?? null;
}

describe("block list indent (ticket 0053, finding 11)", () => {
  it("reads items at two spaces", () => {
    expect(listsOf(withList("  "))).toEqual(["[[Focus]]"]);
  });

  it("reads items with no indent", () => {
    expect(listsOf(withList(""))).toEqual(["[[Focus]]"]);
  });

  it("reads items at four spaces", () => {
    expect(listsOf(withList("    "))).toEqual(["[[Focus]]"]);
  });

  it("reads items after a tab", () => {
    expect(listsOf(withList("\t"))).toEqual(["[[Focus]]"]);
  });

  // The editor seeds its draft from the parsed lists. A list the parser
  // missed seeds as empty, and the save deletes it from the note.
  it("keeps a four-space list through an editor save", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": withList("    ") });
    const item = taskFromText(
      { id: URI, uri: URI, fileName: "Call.md", name: "Call" },
      withList("    "),
    );
    await saveTaskEdit(vault, item, {
      name: "Call",
      due: "2026-11-01",
      recurrence: null,
      lists: (item.data?.lists ?? []).map((link) => link.slice(2, -2)),
      reminders: [],
      body: item.body,
    });
    expect(vault.hooks.read("Tasks/Call.md")).toContain("[[Focus]]");
  });

  // The writer found the end of a list only at an indent, so a save
  // replaced the key line and left an item with no indent behind.
  it.each([
    ["no indent", ""],
    ["a tab", "\t"],
  ])("writes a list at %s back once through an editor save", async (_label, indent) => {
    const vault = createMemoryVault({ "Tasks/Call.md": withList(indent) });
    const item = taskFromText(
      { id: URI, uri: URI, fileName: "Call.md", name: "Call" },
      withList(indent),
    );
    await saveTaskEdit(vault, item, {
      name: "Call",
      due: "2026-11-01",
      recurrence: null,
      lists: (item.data?.lists ?? []).map((link) => link.slice(2, -2)),
      reminders: [],
      body: item.body,
    });
    const saved = vault.hooks.read("Tasks/Call.md") ?? "";
    expect(listsOf(saved)).toEqual(["[[Focus]]"]);
    expect(saved.match(/\[\[Focus\]\]/g)).toHaveLength(1);
  });
});

describe("quoted values (ticket 0053, finding 16)", () => {
  const empty = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';

  it("reads back a title that starts with a quote", () => {
    const text = updateProperty(empty, "title", '"Dune" by Herbert');
    const data = validateNote("Dune.md", text, taskFrontmatter).data;
    expect(data?.title).toBe('"Dune" by Herbert');
  });

  it("reads back a quoted title that holds a backslash", () => {
    const text = updateProperty(empty, "title", "#1 \\ backlog");
    const data = validateNote("Backlog.md", text, taskFrontmatter).data;
    expect(data?.title).toBe("#1 \\ backlog");
  });
});

describe("typed name survives a safe file name (ticket 0053, finding 15)", () => {
  // safeFileName turns the colon into a space, and the provider keeps
  // that name. createNote wrote no title, so the next read showed the
  // file name instead of what the user typed.
  it("shows the typed name after the next read", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": withList("  ") });
    const draft = captureDraft({ name: "Pay bill: water" }, { kind: "main" });
    await createNote(vault, TASKS, draft.fileName, draft.content, draft.name);
    const rows = await loadTasks(vault, TASKS);
    const row = rows.find((item) => item.fileName === "Pay bill water.md");
    expect(row?.name).toBe("Pay bill: water");
  });
});
