import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import type { TaskSection } from "@/stores/tasks/selectors";
import { buildSections, foldCompleted } from "./list-sections";

function task(name: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20" },
    body: "",
  };
}

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
