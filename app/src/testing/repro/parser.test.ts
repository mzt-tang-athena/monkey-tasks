// Reproductions of audit findings 11, 15 and 16, written before the
// fixes (ticket 0053). Each one ran as `it.fails` until its fix landed,
// and now runs as a plain `it`. The parser cases hold because ticket
// 0053 moved the contracts submodule to the parser fix.

import { describe, expect, it } from "vitest";
import { taskFrontmatter, taskIsDone, validateNote } from "@monkey-tasks/schemas";
import { MEMORY_ROOT, createMemoryVault } from "@/lib/vault/adapters/memory";
import { createNote } from "@/lib/vault/notes";
import { updateProperty } from "@/lib/vault/frontmatter";
import { loadTasks, taskFromText } from "@/stores/tasks/task-notes";
import { saveTaskEdit } from "@/lib/vault/save-task-edit";
import { captureDraft } from "@/stores/tasks/capture-draft";
import { SAMPLE_DAY, sampleSeed } from "@/lib/vault/sample/seed";

const TASKS = `${MEMORY_ROOT}/Tasks`;
const URI = `${TASKS}/Call.md`;

/** A legacy task note whose Focus list item sits at the given indent. */
function withList(indent: string): string {
  return `---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nlists:\n${indent}- "[[Focus]]"\n---\n`;
}

function listOf(text: string): string | null {
  return validateNote("Call.md", text, taskFrontmatter).data?.list ?? null;
}

describe("block list indent (ticket 0053, finding 11)", () => {
  it("reads items at two spaces", () => {
    expect(listOf(withList("  "))).toBe("[[Focus]]");
  });

  it("reads items with no indent", () => {
    expect(listOf(withList(""))).toBe("[[Focus]]");
  });

  it("reads items at four spaces", () => {
    expect(listOf(withList("    "))).toBe("[[Focus]]");
  });

  it("reads items after a tab", () => {
    expect(listOf(withList("\t"))).toBe("[[Focus]]");
  });

  // The editor seeds its draft from the parsed list. A list the parser
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
      list: item.data?.list?.slice(2, -2) ?? null,
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
      list: item.data?.list?.slice(2, -2) ?? null,
      reminders: [],
      body: item.body,
    });
    const saved = vault.hooks.read("Tasks/Call.md") ?? "";
    expect(listOf(saved)).toBe("[[Focus]]");
    expect(saved.match(/\[\[Focus\]\]/g)).toHaveLength(1);
  });
});

describe("one list field (ticket 20261111-one-list-field)", () => {
  const base = { id: URI, uri: URI, fileName: "Call.md", name: "Call" };
  const twoLinks =
    '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\nlists:\n  - "[[Focus]]"\n  - "[[Home]]"\n---\n\nBody.\n';

  it("reads the first link of a legacy two-link lists field", () => {
    const data = validateNote("Call.md", twoLinks, taskFrontmatter).data;

    expect(data?.list).toBe("[[Focus]]");
    expect(data).not.toHaveProperty("lists");
  });

  it("drops the legacy lists field on an editor save", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": twoLinks });
    const item = taskFromText(base, twoLinks);

    await saveTaskEdit(vault, item, {
      name: "Call",
      due: null,
      recurrence: null,
      list: "Home",
      reminders: [],
      body: item.body,
    });

    const saved = vault.hooks.read("Tasks/Call.md") ?? "";
    expect(saved).toContain('list: "[[Home]]"');
    expect(saved).not.toContain("lists:");
    expect(saved.match(/\[\[(Focus|Home)\]\]/g)).toHaveLength(1);
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

describe("a hand-written kind (monkey-tasks ticket 20261111-kind-accepts-both-shapes)", () => {
  const base = { id: URI, uri: URI, fileName: "Call.md", name: "Call" };
  const bare = "---\nkind: tasks\ncreated: 2026-10-20\n---\n";
  const link = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';

  it("reads a bare kind and returns the link form", () => {
    const row = taskFromText(base, bare);
    expect(row.errors).toBeUndefined();
    expect(row.data?.kind).toBe("[[tasks]]");
  });

  it("reads the link form unchanged", () => {
    const row = taskFromText(base, link);
    expect(row.data?.kind).toBe("[[tasks]]");
  });

  it("loads the sample note another tool wrote", async () => {
    const vault = createMemoryVault(sampleSeed(["default"], SAMPLE_DAY));
    const rows = await loadTasks(vault, TASKS);
    const row = rows.find((item) => item.fileName === "Read the meter.md");
    expect(row?.errors).toBeUndefined();
    expect(row?.data?.kind).toBe("[[tasks]]");
  });
});

describe("a completion takes a time (monkey-tasks ticket 20261111-completed-takes-a-time)", () => {
  const base = { id: URI, uri: URI, fileName: "Call.md", name: "Call" };

  it("reads a completion with a time and keeps it", () => {
    const row = taskFromText(
      base,
      '---\nkind: "[[tasks]]"\ncreated: 2026-11-11\ncompleted: 2026-11-11T18:08\n---\n',
    );
    expect(row.errors).toBeUndefined();
    expect(row.data?.completed).toBe("2026-11-11T18:08");
    expect(taskIsDone(row.data!)).toBe(true);
  });

  it("reads a completion with a date alone", () => {
    const row = taskFromText(
      base,
      '---\nkind: "[[tasks]]"\ncreated: 2026-11-11\ncompleted: 2026-11-11\n---\n',
    );
    expect(row.errors).toBeUndefined();
    expect(row.data?.completed).toBe("2026-11-11");
    expect(taskIsDone(row.data!)).toBe(true);
  });

  it("loads the sample notes with both shapes", async () => {
    const vault = createMemoryVault(sampleSeed(["default"], SAMPLE_DAY));
    const rows = await loadTasks(vault, TASKS);
    const timed = rows.find((item) => item.fileName === "Water the fern.md");
    const dated = rows.find((item) => item.fileName === "Buy stamps.md");
    expect(timed?.errors).toBeUndefined();
    expect(timed?.data?.completed).toBe("2026-10-26T18:08");
    expect(dated?.errors).toBeUndefined();
    expect(dated?.data?.completed).toBe("2026-10-26");
  });
});
