import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import { buildSections, completedTitle, myOrderKey } from "./list-sections";

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
