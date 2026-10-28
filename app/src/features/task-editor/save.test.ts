import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteChangedError } from "@/lib/vault/notes";

// The editor writes through two doors: the note helpers and the SAF
// document calls a rename needs. Both are recorded here so a test can
// see the order the file system saw.

const state = vi.hoisted(() => ({
  writes: [] as { uri: string; text: string }[],
  deletes: [] as string[],
  creates: [] as { folder: string; fileName: string; mime: string }[],
  events: [] as string[],
  createdUri: "",
  failWrite: false,
  fileText: "",
}));

vi.mock("expo-file-system/legacy", () => ({
  StorageAccessFramework: {
    createFileAsync: async (
      folder: string,
      fileName: string,
      mime: string,
    ) => {
      state.creates.push({ folder, fileName, mime });
      state.events.push("create");
      return state.createdUri;
    },
  },
  deleteAsync: async (uri: string) => {
    state.deletes.push(uri);
    state.events.push("delete");
  },
  EncodingType: { UTF8: "utf8" },
  readAsStringAsync: async () => state.fileText,
  writeAsStringAsync: async (uri: string, text: string) => {
    if (state.failWrite) {
      throw new Error("disk full");
    }
    state.writes.push({ uri, text });
    state.events.push("write");
  },
}));

import { saveTaskEdit } from "./save";
import type { TaskEdit, TaskItem } from "@/types/task";

const OLD_URI =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks%2FCall.md";
const FOLDER_URI =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks";
const NEW_URI =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks%2FNew%20name.md";

function task(): TaskItem {
  return {
    id: OLD_URI,
    uri: OLD_URI,
    fileName: "Call.md",
    name: "Call",
    text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\ndue: 2026-10-21\nreminders:\n  - 2026-10-21T09:00\nlists:\n  - [[Focus]]\n---\n\nOld body.\n',
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      due: "2026-10-21",
      reminders: ["2026-10-21T09:00"],
      lists: ["[[Focus]]"],
    },
    body: "\nOld body.\n",
  };
}

function edit(overrides: Partial<TaskEdit> = {}): TaskEdit {
  return {
    name: "Call",
    due: "2026-10-21",
    recurrence: null,
    lists: ["Focus"],
    reminders: ["2026-10-21T09:00"],
    body: "\nOld body.\n",
    ...overrides,
  };
}

beforeEach(() => {
  state.writes.length = 0;
  state.deletes.length = 0;
  state.creates.length = 0;
  state.events.length = 0;
  state.createdUri = NEW_URI;
  state.failWrite = false;
  state.fileText = task().text;
});

describe("saveTaskEdit", () => {
  it("writes a changed due date and refreshes the row", async () => {
    const item = task();
    const result = await saveTaskEdit(item, edit({ due: "2026-10-25" }));

    expect(state.writes).toHaveLength(1);
    expect(state.creates).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
    expect(state.writes[0].uri).toBe(OLD_URI);
    expect(state.writes[0].text).toContain("due: 2026-10-25");
    expect(state.writes[0].text).not.toContain("due: 2026-10-21");
    expect(result.uri).toBe(OLD_URI);
    expect(result.text).toBe(state.writes[0].text);
    expect(result.data?.due).toBe("2026-10-25");
    expect(result.body).toBe("\nOld body.\n");
  });

  it("clears a property when the edit has no value for it", async () => {
    const result = await saveTaskEdit(
      task(),
      edit({ due: null, reminders: [], lists: [] }),
    );

    expect(result.text).not.toContain("due:");
    expect(result.text).not.toContain("reminders");
    expect(result.text).not.toContain("lists");
    expect(result.data?.due).toBeUndefined();
    expect(result.data?.reminders).toBeUndefined();
    expect(result.data?.lists).toBeUndefined();
  });

  it("writes a one-item list as a block list", async () => {
    const minimal: TaskItem = {
      ...task(),
      text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nOld body.\n',
      data: { kind: "[[tasks]]", created: "2026-10-20" },
    };
    state.fileText = minimal.text;

    const result = await saveTaskEdit(
      minimal,
      edit({
        lists: ["Errands"],
        reminders: ["2026-10-25T08:00"],
      }),
    );

    expect(result.text).toContain('lists:\n  - "[[Errands]]"');
    expect(result.text).toContain("reminders:\n  - 2026-10-25T08:00");
    expect(result.data?.lists).toEqual(["[[Errands]]"]);
    expect(result.data?.reminders).toEqual(["2026-10-25T08:00"]);
  });

  it("replaces the body below the frontmatter", async () => {
    const result = await saveTaskEdit(
      task(),
      edit({ body: "\nNew body.\n" }),
    );

    expect(result.text).not.toContain("Old body");
    expect(result.text.endsWith('---\n\nNew body.\n')).toBe(true);
    expect(result.body).toBe("\nNew body.\n");
  });

  it("creates the new file, then deletes the old one on a rename", async () => {
    const result = await saveTaskEdit(task(), edit({ name: "New name" }));

    expect(state.creates).toEqual([
      { folder: FOLDER_URI, fileName: "New name.md", mime: "text/markdown" },
    ]);
    expect(state.writes).toEqual([{ uri: NEW_URI, text: result.text }]);
    expect(state.deletes).toEqual([OLD_URI]);
    // SAF has no rename: create, write, then delete the old file.
    expect(state.events).toEqual(["create", "write", "delete"]);
    expect(result.uri).toBe(NEW_URI);
    expect(result.fileName).toBe("New name.md");
    expect(result.name).toBe("New name");
    // The row keeps its identity so the list does not remount it.
    expect(result.id).toBe(OLD_URI);
  });

  it("writes the typed title when the provider renames on a rename", async () => {
    state.createdUri = NEW_URI.replace("New%20name.md", "New%20name%20(1).md");

    const result = await saveTaskEdit(task(), edit({ name: "New name" }));

    expect(result.fileName).toBe("New name (1).md");
    expect(result.text).toContain("title: New name");
    expect(result.data?.title).toBe("New name");
    expect(result.name).toBe("New name");
    expect(state.writes).toEqual([{ uri: state.createdUri, text: result.text }]);
  });

  it("writes the typed title when the rename cleans the name", async () => {
    state.createdUri = NEW_URI.replace("New%20name.md", "Pay%20bill%20water.md");

    const result = await saveTaskEdit(task(), edit({ name: "Pay bill: water" }));

    expect(state.creates[0]?.fileName).toBe("Pay bill water.md");
    expect(result.fileName).toBe("Pay bill water.md");
    expect(result.data?.title).toBe("Pay bill: water");
    expect(state.writes).toEqual([{ uri: state.createdUri, text: result.text }]);
  });

  it("writes the typed title when the cleaned name keeps the file", async () => {
    const item: TaskItem = {
      ...task(),
      fileName: "Pay bill water.md",
      name: "Pay bill water",
    };

    const result = await saveTaskEdit(item, edit({ name: "Pay bill: water" }));

    // The file name already fits, so there is no rename.
    expect(state.creates).toEqual([]);
    expect(state.deletes).toEqual([]);
    expect(result.fileName).toBe("Pay bill water.md");
    expect(result.data?.title).toBe("Pay bill: water");
    expect(state.writes).toEqual([{ uri: OLD_URI, text: result.text }]);
  });

  it("writes no title when the file name holds the typed name", async () => {
    const result = await saveTaskEdit(task(), edit({ body: "\nNew body.\n" }));

    expect(result.text).not.toContain("title:");
    expect(result.data?.title).toBeUndefined();
  });

  it("refuses when the editor opened an older text than the store holds", async () => {
    const item = task();
    const opened = item.text.replace("Old body.", "Opened body.");
    // The store refreshed after the editor mounted: its text is newer
    // than the draft the user is looking at.
    state.fileText = item.text;

    await expect(
      saveTaskEdit(item, edit({ body: "\nNew body.\n" }), opened),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(state.writes).toHaveLength(0);
  });

  it("refuses to save when the note changed on disk", async () => {
    const item = task();
    state.fileText = item.text.replace("Old body.", "Edited in Obsidian.");

    await expect(
      saveTaskEdit(item, edit({ body: "\nNew body.\n" })),
    ).rejects.toBeInstanceOf(NoteChangedError);

    expect(state.writes).toHaveLength(0);
    expect(state.deletes).toEqual([]);
    expect(state.creates).toEqual([]);
  });

  it("edits the title instead of renaming a titled note", async () => {
    const item: TaskItem = {
      ...task(),
      fileName: "Water plants 2026-10-27.md",
      name: "Water plants",
      text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\ntitle: Water plants\ndue: 2026-10-27\n---\n\nOld body.\n',
      data: {
        kind: "[[tasks]]",
        created: "2026-10-20",
        title: "Water plants",
        due: "2026-10-27",
      },
    };
    state.fileText = item.text;

    const result = await saveTaskEdit(
      item,
      edit({ name: "Water the ferns", body: "\nNew body.\n" }),
    );

    expect(state.creates).toEqual([]);
    expect(state.deletes).toEqual([]);
    expect(result.fileName).toBe("Water plants 2026-10-27.md");
    expect(result.name).toBe("Water the ferns");
    expect(result.text).toContain("title: Water the ferns");
    expect(result.data?.title).toBe("Water the ferns");
  });

  it("leaves the old note in place when the save fails", async () => {
    state.failWrite = true;
    const item = task();

    await expect(
      saveTaskEdit(item, edit({ name: "New name" })),
    ).rejects.toThrow("disk full");

    // The half-written copy is gone and the old file is untouched.
    expect(state.writes).toHaveLength(0);
    expect(state.deletes).toEqual([NEW_URI]);
    expect(state.events).toEqual(["create", "delete"]);
    expect(item.uri).toBe(OLD_URI);
    expect(item.name).toBe("Call");
    expect(item.text).toContain("Old body.");
  });
});
