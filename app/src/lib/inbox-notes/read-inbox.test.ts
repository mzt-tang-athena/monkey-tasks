import { describe, expect, it } from "vitest";
import { createMemoryVault, MEMORY_ROOT } from "@/lib/vault/adapters/memory";
import { NoteChangedError } from "@/lib/vault/notes";
import {
  createInboxNote,
  ensureInboxFolder,
  loadInbox,
  saveInboxNote,
} from "./read-inbox";
import { splitNote } from "./model";

const at = new Date(2026, 10, 4, 12, 10);

describe("loadInbox", () => {
  it("reads a missing folder as no notes and creates nothing", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "x" });
    expect(await loadInbox(vault, MEMORY_ROOT)).toEqual({
      folder: null,
      notes: [],
      unreadable: [],
    });
    expect(Object.keys(vault.hooks.files())).toEqual(["Tasks/Call.md"]);
  });

  it("reads top-level markdown files, sorted, and skips other files", async () => {
    const vault = createMemoryVault({
      "Inbox/20260919-flight.md": "old",
      "Inbox/202611041210.md": "new",
      "Inbox/declarative-vault.md": "plain",
      "Inbox/notes.txt": "not a note",
      "Inbox/sub/deep.md": "not top level",
    });
    const read = await loadInbox(vault, MEMORY_ROOT);
    expect(read.notes.map((note) => note.fileName)).toEqual([
      "202611041210.md",
      "20260919-flight.md",
      "declarative-vault.md",
    ]);
    expect(read.unreadable).toEqual([]);
  });

  it("keeps the other notes when one file cannot be read", async () => {
    const vault = createMemoryVault(
      { "Inbox/202611041210.md": "one", "Inbox/bad.md": "two" },
      {
        fail(op, uri) {
          return op === "read" && uri.endsWith("bad.md")
            ? new Error("no")
            : null;
        },
      },
    );
    const read = await loadInbox(vault, MEMORY_ROOT);
    expect(read.notes.map((note) => note.fileName)).toEqual(["202611041210.md"]);
    expect(read.unreadable).toEqual(["bad.md"]);
  });
});

describe("ensureInboxFolder", () => {
  it("finds the folder, then makes it once", async () => {
    const vault = createMemoryVault({});
    const first = await ensureInboxFolder(vault, MEMORY_ROOT);
    const second = await ensureInboxFolder(vault, MEMORY_ROOT);
    expect(second).toBe(first);
    expect(vault.hooks.files()).toEqual({});
  });
});

describe("createInboxNote", () => {
  it("writes the body exactly, with no frontmatter", async () => {
    const vault = createMemoryVault({});
    const created = await createInboxNote(
      vault,
      MEMORY_ROOT,
      { title: "", body: "# A thought\n\nwith markdown" },
      at,
    );
    expect(created.note.fileName).toBe("202611041210.md");
    expect(vault.hooks.read("Inbox/202611041210.md")).toBe(
      "# A thought\n\nwith markdown",
    );
  });

  it("adds a slug for a typed title", async () => {
    const vault = createMemoryVault({});
    await createInboxNote(
      vault,
      MEMORY_ROOT,
      { title: "Buy stamps", body: "two books" },
      at,
    );
    expect(vault.hooks.read("Inbox/202611041210-buy-stamps.md")).toBe(
      "two books",
    );
  });

  it("lets the provider name a collision", async () => {
    const vault = createMemoryVault({});
    const first = await createInboxNote(
      vault,
      MEMORY_ROOT,
      { title: "", body: "one" },
      at,
    );
    const second = await createInboxNote(
      vault,
      MEMORY_ROOT,
      { title: "", body: "two" },
      at,
    );
    expect(first.note.fileName).toBe("202611041210.md");
    expect(second.note.fileName).toBe("202611041210 (1).md");
    expect(vault.hooks.read("Inbox/202611041210 (1).md")).toBe("two");
  });
});

describe("saveInboxNote", () => {
  it("writes the body back and keeps the frontmatter byte for byte", async () => {
    const text = "---\r\nkind: resource\r\n---\r\nold body\r\n";
    const vault = createMemoryVault({ "Inbox/202610011200.md": text });
    const uri = `${MEMORY_ROOT}/Inbox/202610011200.md`;
    const parts = splitNote(text);
    const next = await saveInboxNote(vault, {
      uri,
      head: parts.head,
      body: "new body\n",
      expected: text,
    });
    expect(next).toBe("---\r\nkind: resource\r\n---\r\nnew body\n");
    expect(vault.hooks.read("Inbox/202610011200.md")).toBe(next);
  });

  it("refuses a file another writer changed", async () => {
    const path = "Inbox/202610011200.md";
    const vault = createMemoryVault({ [path]: "old" });
    const uri = `${MEMORY_ROOT}/${path}`;
    vault.hooks.write(path, "changed");
    await expect(
      saveInboxNote(vault, {
        uri,
        head: "",
        body: "mine",
        expected: "old",
      }),
    ).rejects.toBeInstanceOf(NoteChangedError);
    expect(vault.hooks.read(path)).toBe("changed");
  });
});
