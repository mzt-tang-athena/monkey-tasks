import { describe, expect, it } from "vitest";
import { MEMORY_ROOT, createMemoryVault } from "@/lib/vault/adapters/memory";
import { loadLists, parseListNote } from "./list-notes";

// The test pins what makes a note a list tab: the kind in its
// frontmatter, and its file name minus the extension. Anything else in
// the folder comes back as broken, so it can be fixed instead of
// vanishing.

const tasksDir = `${MEMORY_ROOT}/Tasks`;
const listsDir = `${tasksDir}/Lists`;

const listText = (name: string) =>
  `---\nkind: "[[lists]]"\ncreated: 2026-10-20\n---\n\n${name}\n`;

const taskText = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nBody.\n';

describe("parseListNote", () => {
  it("names a list note after its file, minus the extension", () => {
    expect(parseListNote("Focus.md", listText("Focus"))).toEqual({
      name: "Focus",
      errors: [],
    });
    expect(parseListNote("2026 groceries.md", listText("groceries"))).toEqual({
      name: "2026 groceries",
      errors: [],
    });
  });

  it("accepts a bare kind, not only a quoted one", () => {
    const text = "---\nkind: [[lists]]\ncreated: 2026-10-20\n---\n";

    expect(parseListNote("Errands.md", text)).toEqual({
      name: "Errands",
      errors: [],
    });
  });

  it("rejects a task note carrying the tasks kind and says why", () => {
    const result = parseListNote("Call.md", taskText);

    expect(result.name).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^kind: /);
  });

  it("rejects text with no readable frontmatter", () => {
    const bare = parseListNote("Broken.md", "no frontmatter here");
    expect(bare.name).toBeNull();
    expect(bare.errors.length).toBeGreaterThan(0);

    const undated = parseListNote("Bad.md", '---\nkind: "[[lists]]"\n---\n');
    expect(undated.name).toBeNull();
    expect(undated.errors).toHaveLength(1);
    expect(undated.errors[0]).toMatch(/^created: /);
  });

  it("reports an empty created date as a created issue", () => {
    const text = '---\nkind: "[[lists]]"\ncreated:\n---\n';

    const result = parseListNote("Unscheduled.md", text);

    expect(result.name).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^created: /);
  });

  it("parses a list whose body holds a list.base code block, leaving the body alone", () => {
    const text = [
      "---",
      'kind: "[[lists]]"',
      "created: 2026-10-20",
      "---",
      "",
      "```list.base",
      "kind: [[lists]]",
      "created: 2026-10-20",
      "```",
      "",
    ].join("\n");

    const result = parseListNote("Focus.md", text);

    expect(result).toEqual({ name: "Focus", errors: [] });
    // The block below the frontmatter is note content, never parsed.
    expect(text).toContain("```list.base");
  });
});

describe("loadLists", () => {
  it("reads the Lists folder inside Tasks and returns its notes sorted", async () => {
    const vault = createMemoryVault({
      "Tasks/Lists/Work.md": listText("Work"),
      "Tasks/Lists/Focus.md": listText("Focus"),
      "Tasks/Lists/Archive/Old.md": listText("Old"),
    });

    const result = await loadLists(vault, tasksDir);

    expect(result).toEqual({
      lists: [
        { name: "Focus", uri: `${listsDir}/Focus.md` },
        { name: "Work", uri: `${listsDir}/Work.md` },
      ],
      broken: [],
    });
  });

  it("reports a note that fails the frontmatter and keeps the good ones", async () => {
    const vault = createMemoryVault({
      "Tasks/Lists/Focus.md": listText("Focus"),
      "Tasks/Lists/Tasks.md": taskText,
      "Tasks/Lists/Errands.md": '---\nkind: "[[lists]]"\ncreated:\n---\n',
    });

    const result = await loadLists(vault, tasksDir);

    expect(result.lists).toEqual([
      { name: "Focus", uri: `${listsDir}/Focus.md` },
    ]);
    expect(result.broken.map((note) => note.name)).toEqual([
      "Errands",
      "Tasks",
    ]);
    expect(result.broken[0]).toEqual({
      name: "Errands",
      uri: `${listsDir}/Errands.md`,
      errors: [expect.stringMatching(/^created: /)],
    });
    expect(result.broken[1].errors).toEqual([
      expect.stringMatching(/^kind: /),
    ]);
  });

  it("skips a note that cannot be read without dropping the rest", async () => {
    const vault = createMemoryVault({
      "Tasks/Lists/Focus.md": listText("Focus"),
      "Tasks/Lists/Locked.md": listText("Locked"),
    });
    vault.hooks.failNext("read", "Locked.md");

    const result = await loadLists(vault, tasksDir);

    expect(result).toEqual({
      lists: [{ name: "Focus", uri: `${listsDir}/Focus.md` }],
      broken: [],
    });
  });

  it("returns nothing when the Lists folder does not exist", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": taskText });

    await expect(loadLists(vault, tasksDir)).resolves.toEqual({
      lists: [],
      broken: [],
    });
    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Call.md"]);
  });
});
