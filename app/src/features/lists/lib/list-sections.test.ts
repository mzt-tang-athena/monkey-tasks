import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import type { TaskSection } from "@/stores/tasks/selectors";
import {
  buildSections,
  completedTitle,
  foldCompleted,
  myOrderKey,
} from "./list-sections";

function task(name: string, completed?: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      "alert weight": "harsh",
      ...(completed ? { completed } : {}),
    },
  };
}

describe("buildSections", () => {
  it("keys My order's headerless group apart from Completed", () => {
    const sections = buildSections(
      [{ title: null, items: [task("A"), task("B")], tone: "ink" }],
      [task("Done", "2026-10-26")],
    );

    expect(sections.map((section) => section.key)).toEqual([
      myOrderKey,
      completedTitle,
    ]);
    expect(sections[0].title).toBeNull();
    expect(sections[1].title).toBe(completedTitle);
  });

  it("keeps a date title as the key", () => {
    const sections = buildSections(
      [{ title: "Today", items: [task("A")], tone: "ink" }],
      [],
    );

    expect(sections).toEqual([
      { key: "Today", title: "Today", tone: "ink", data: [task("A")] },
    ]);
  });
});

const open: TaskSection[] = [
  { title: "Today", items: [task("Pay rent")], tone: "ink" },
];
const done = [task("Buy stamps"), task("Water the fern")];

describe("foldCompleted", () => {
  it("keeps the Completed header and drops its rows", () => {
    const sections = buildSections(open, done);

    const folded = foldCompleted(sections, false);

    expect(folded.map((section) => section.key)).toEqual(["Today", "Completed"]);
    expect(folded.map((section) => section.data.length)).toEqual([1, 0]);
    expect(folded[1].tone).toBe("faint");
  });

  it("returns the groups unchanged when Completed is open", () => {
    const sections = buildSections(open, done);

    expect(foldCompleted(sections, true)).toBe(sections);
  });

  it("leaves the open groups alone", () => {
    const sections = buildSections(open, done);

    const folded = foldCompleted(sections, false);

    expect(folded[0]).toEqual(sections[0]);
  });
});
