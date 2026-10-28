import { describe, expect, it } from "vitest";
import { validateNote, taskFrontmatter } from "@monkey-tasks/schemas";
import { load } from "js-yaml";
import {
  isUntouchedSpawn,
  spawnContent,
  spawnFileName,
  type SpawnInput,
} from "./spawn";
import type { TaskItem } from "@/types/task";

/** What a standard YAML parser makes of the note spawn wrote. */
function frontmatter(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) {
    throw new Error("no frontmatter block");
  }
  return load(match[1]) as Record<string, unknown>;
}

/** The text below the frontmatter block, exactly as a reader gets it. */
function bodyOf(text: string): string {
  const match = /^---\n[\s\S]*?\n---(?:\n|$)/.exec(text);
  if (!match) {
    throw new Error("no frontmatter block");
  }
  return text.slice(match[0].length);
}

const sample: SpawnInput = {
  title: "Call Mum",
  previous: "Call Mum 2026-10-18",
  due: "2026-10-25",
  recurrence: "FREQ=WEEKLY",
  lists: ["[[Focus]]", "[[Home]]"],
  reminders: ["2026-10-25T09:00", "2026-10-25T18:30"],
  body: "Ring her about the weekend.\n",
};

const created = "2026-10-24";

/** The row loadTasks would build for the note spawn wrote. */
function spawnItem(input: SpawnInput): TaskItem {
  const fileName = spawnFileName(input.title, input.due, new Set());
  const text = spawnContent(input, created);
  const { note, data } = validateNote(fileName, text, taskFrontmatter);
  return {
    id: `content://vault/Tasks/${fileName}`,
    uri: `content://vault/Tasks/${fileName}`,
    fileName,
    name: fileName.replace(/\.md$/, ""),
    text,
    data,
    body: note.body,
  };
}

describe("spawnFileName", () => {
  it("names a plain occurrence by title and due day", () => {
    expect(spawnFileName("Call Mum", "2026-10-25", new Set())).toBe(
      "Call Mum 2026-10-25.md",
    );
  });

  it("counts past a name already in the folder", () => {
    const taken = new Set(["Call Mum 2026-10-25.md"]);
    expect(spawnFileName("Call Mum", "2026-10-25", taken)).toBe(
      "Call Mum 2026-10-25 2.md",
    );
    taken.add("Call Mum 2026-10-25 2.md");
    expect(spawnFileName("Call Mum", "2026-10-25", taken)).toBe(
      "Call Mum 2026-10-25 3.md",
    );
  });

  it("takes the day from a datetime due", () => {
    const taken = new Set(["Call Mum 2026-10-25.md"]);
    expect(spawnFileName("Call Mum", "2026-10-25T15:00", taken)).toBe(
      "Call Mum 2026-10-25 2.md",
    );
  });

  it("sanitises a title a document provider would refuse", () => {
    expect(
      spawnFileName("Call/Mum: now?", "2026-10-25", new Set()),
    ).toBe("Call Mum now 2026-10-25.md");
  });
});

describe("spawnContent", () => {
  it("writes every property the next occurrence needs", () => {
    const data = frontmatter(spawnContent(sample, created));
    expect(data).toEqual({
      kind: "[[tasks]]",
      created,
      title: "Call Mum",
      due: "2026-10-25",
      recurrence: "FREQ=WEEKLY",
      lists: ["[[Focus]]", "[[Home]]"],
      reminders: ["2026-10-25T09:00", "2026-10-25T18:30"],
      "recurrence previous": "[[Call Mum 2026-10-18]]",
    });
  });

  it("writes the properties in the documented order", () => {
    const text = spawnContent(sample, created);
    const order = [
      "kind:",
      "created:",
      "title:",
      "due:",
      "recurrence:",
      "lists:",
      "reminders:",
      "recurrence previous:",
    ];
    const positions = order.map((key) => text.indexOf(key));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });

  it("validates as a task note", () => {
    const text = spawnContent(sample, created);
    const result = validateNote("Call Mum 2026-10-25.md", text, taskFrontmatter);
    expect(result.errors).toBeNull();
    expect(result.data).toEqual({
      kind: "[[tasks]]",
      created,
      title: "Call Mum",
      due: "2026-10-25",
      recurrence: "FREQ=WEEKLY",
      lists: ["[[Focus]]", "[[Home]]"],
      reminders: ["2026-10-25T09:00", "2026-10-25T18:30"],
      "recurrence previous": "[[Call Mum 2026-10-18]]",
    });
  });

  it("copies the body unchanged", () => {
    expect(bodyOf(spawnContent(sample, created))).toBe(sample.body);
  });
});

describe("isUntouchedSpawn", () => {
  it("accepts the note spawn wrote", () => {
    expect(isUntouchedSpawn(spawnItem(sample), sample)).toBe(true);
  });

  it("accepts a different created date, which the tick does not own", () => {
    const item = spawnItem(sample);
    expect(
      isUntouchedSpawn(
        { ...item, data: { ...item.data!, created: "2026-10-01" } },
        sample,
      ),
    ).toBe(true);
  });

  it("rejects an edited body", () => {
    const item = spawnItem(sample);
    expect(
      isUntouchedSpawn({ ...item, body: `${item.body}One more thing.\n` }, sample),
    ).toBe(false);
  });

  it("rejects changed lists", () => {
    const item = spawnItem(sample);
    expect(
      isUntouchedSpawn(
        { ...item, data: { ...item.data!, lists: ["[[Later]]"] } },
        sample,
      ),
    ).toBe(false);
  });

  it("rejects lists in another order", () => {
    const item = spawnItem(sample);
    expect(
      isUntouchedSpawn(
        {
          ...item,
          data: { ...item.data!, lists: ["[[Home]]", "[[Focus]]"] },
        },
        sample,
      ),
    ).toBe(false);
  });

  it("rejects a changed due date", () => {
    const item = spawnItem(sample);
    expect(
      isUntouchedSpawn(
        { ...item, data: { ...item.data!, due: "2026-11-01" } },
        sample,
      ),
    ).toBe(false);
  });

  it("rejects a completed note", () => {
    const item = spawnItem(sample);
    expect(
      isUntouchedSpawn(
        { ...item, data: { ...item.data!, completed: "2026-10-25" } },
        sample,
      ),
    ).toBe(false);
  });

  it("rejects a note spawned from another occurrence", () => {
    const item = spawnItem(sample);
    expect(
      isUntouchedSpawn(
        {
          ...item,
          data: {
            ...item.data!,
            "recurrence previous": "[[Call Mum 2026-10-11]]",
          },
        },
        sample,
      ),
    ).toBe(false);
  });
});
