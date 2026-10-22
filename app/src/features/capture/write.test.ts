import { describe, expect, it, vi, type Mock } from "vitest";
import { captureContent, safeFileName, writeCapture } from "./write";
import { todayIso } from "../../lib/dates";
import { createNote } from "../vault/notes";
import type { ParsedCapture } from "./parse";

vi.mock("../vault/notes", () => ({
  createNote: vi.fn(
    async (_dir: string, fileName: string, content: string) => ({
      uri: "mock://new/" + fileName,
      fileName,
      content,
    }),
  ),
}));

const mockCreate = vi.mocked(createNote) as Mock;

const sample: ParsedCapture = {
  name: "water the plants",
  due: "2026-10-21T07:30",
  recurrence: "FREQ=DAILY;INTERVAL=2",
  reminders: ["2026-10-21T07:30"],
};

describe("captureContent", () => {
  it("writes the frontmatter only, no replacement surgery", () => {
    const text = captureContent(sample);
    expect(text).toBe(
      [
        "---",
        'kind: "[[tasks]]"',
        `created: ${todayIso()}`,
        "due: 2026-10-21T07:30",
        "reminders:",
        "  - 2026-10-21T07:30",
        'recurrence: "FREQ=DAILY;INTERVAL=2"',
        "---",
        "",
      ].join("\n") + "\n",
    );
  });

  it("emits the lists property natively for a list target", () => {
    const text = captureContent(sample, "Focus");
    expect(text).toContain("lists:");
    expect(text).toContain("  - [[Focus]]");
    expect(text.indexOf("lists:")).toBeGreaterThan(
      text.indexOf("due:"),
    );
    expect(text.trimEnd().endsWith("---")).toBe(true);
  });

  it("writes no lists property for the Main target", () => {
    expect(captureContent(sample)).not.toContain("lists:");
  });
});

describe("writeCapture", () => {
  it("passes the preselected due when the line carries none", async () => {
    const result = await writeCapture(
      "mock://vault/Tasks",
      { name: "order printer paper" },
      { kind: "list", name: "Focus", uri: "mock://vault/Tasks/Lists/Focus.md" },
      "2026-10-24",
    );
    const content = mockCreate.mock.calls[0][2] as string;
    expect(result.fileName).toBe("order printer paper.md");
    expect(content).toContain("due: 2026-10-24");
    expect(content).toContain("[[Focus]]");
  });

  it("keeps the parsed due over the preselected one", async () => {
    await writeCapture(
      "mock://vault/Tasks",
      { name: "renew bike insurance", due: "2026-10-25" },
      { kind: "main" },
      "2026-10-23",
    );
    const content = mockCreate.mock.calls[0][2] as string;
    expect(content).toContain("due: 2026-10-25");
    expect(content).not.toContain("lists:");
  });

  it("writes a file name a document provider accepts", async () => {
    const result = await writeCapture(
      "mock://vault/Tasks",
      { name: "milk/eggs: buy" },
      { kind: "main" },
    );
    expect(result.fileName).toBe("milk eggs buy.md");
  });
});

describe("safeFileName", () => {
  it("drops the characters a provider refuses", () => {
    expect(safeFileName("a/b\\c:d*e?f")).toBe("a b c d e f");
  });

  it("keeps dots inside a name", () => {
    expect(safeFileName("version 2.0")).toBe("version 2.0");
  });

  it("falls back to a plain name when nothing is left", () => {
    expect(safeFileName("///")).toBe("task");
  });

  it("keeps the name short enough for a file system", () => {
    expect(safeFileName("x".repeat(200))).toHaveLength(80);
  });
});
