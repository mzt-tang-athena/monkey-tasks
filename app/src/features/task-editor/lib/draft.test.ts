import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import {
  decode,
  draftOf,
  findTask,
  frontmatterEntries,
  isTaskNote,
  listName,
  parseReminders,
} from "./draft";

function item(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "content://vault/Tasks/Call.md",
    uri: "content://vault/Tasks/Call.md",
    fileName: "Call.md",
    name: "Call",
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20" },
    body: "\nOld body.\n",
    ...overrides,
  };
}

describe("listName", () => {
  it("strips the wikilink brackets", () => {
    expect(listName("[[Focus]]")).toBe("Focus");
  });

  it("passes a bare value through, trimmed", () => {
    expect(listName("  Errands ")).toBe("Errands");
  });

  it("keeps a value with one bracket pair half open", () => {
    expect(listName("[[Focus")).toBe("[[Focus");
  });
});

describe("parseReminders", () => {
  it("trims each line and drops blank ones", () => {
    expect(
      parseReminders(" 2026-10-21T09:00 \n\n2026-10-21T18:30\r\n"),
    ).toEqual(["2026-10-21T09:00", "2026-10-21T18:30"]);
  });
});

describe("decode", () => {
  it("decodes a percent escape", () => {
    expect(decode("a%20b")).toBe("a b");
  });

  it("returns the value when it is not valid escape text", () => {
    expect(decode("100%")).toBe("100%");
  });
});

describe("findTask", () => {
  const stored = item({ id: "content://vault/Tasks/Call%20Mum.md" });
  const tasks = [item({ id: "other" }), stored];

  it("finds a task by its exact id", () => {
    expect(findTask(tasks, "other")?.id).toBe("other");
  });

  it("finds a task when the route decoded the id once", () => {
    expect(findTask(tasks, "content://vault/Tasks/Call Mum.md")).toBe(stored);
  });

  it("finds a task when the stored id is the decoded form", () => {
    const plain = item({ id: "content://vault/Tasks/Call Mum.md" });
    expect(findTask([plain], "content://vault/Tasks/Call%20Mum.md")).toBe(plain);
  });

  it("returns undefined for an unknown id", () => {
    expect(findTask(tasks, "missing")).toBeUndefined();
  });
});

describe("isTaskNote", () => {
  it("accepts a note whose kind is the tasks wikilink", () => {
    expect(isTaskNote(item())).toBe(true);
  });

  it("rejects a deed", () => {
    const deed = item({
      data: { kind: "[[deeds]]" } as unknown as TaskItem["data"],
    });
    expect(isTaskNote(deed)).toBe(false);
  });

  it("rejects a note with no parsed data", () => {
    expect(isTaskNote(item({ data: null }))).toBe(false);
  });
});

describe("draftOf", () => {
  it("seeds the draft from the note", () => {
    const task = item({
      data: {
        kind: "[[tasks]]",
        created: "2026-10-20",
        title: "Call Mum: Sunday",
        due: "2026-10-26",
        recurrence: "FREQ=WEEKLY",
        list: "[[Focus]]",
        reminders: ["2026-10-26T09:00"],
      },
    });

    expect(draftOf(task)).toEqual({
      name: "Call Mum: Sunday",
      due: "2026-10-26",
      recurrence: "FREQ=WEEKLY",
      list: "Focus",
      reminders: ["2026-10-26T09:00"],
      body: "\nOld body.\n",
    });
  });

  it("falls back to the file name and empty fields", () => {
    expect(draftOf(item())).toEqual({
      name: "Call",
      due: null,
      recurrence: null,
      list: null,
      reminders: [],
      body: "\nOld body.\n",
    });
  });
});

describe("frontmatterEntries", () => {
  it("lists the keys in file order, with lists joined", () => {
    const text =
      '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\ncreated: 2026-10-20\n---\n\nBody\n';
    const entries = frontmatterEntries(text);

    expect(entries.map(([key]) => key)).toEqual(["kind", "status", "created"]);
    expect(entries[0]).toEqual(["kind", "[[deeds]]"]);
  });

  it("returns nothing for a note with no frontmatter", () => {
    expect(frontmatterEntries("Just text\n")).toEqual([]);
  });
});
