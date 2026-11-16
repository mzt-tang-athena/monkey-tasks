import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import type { ListsSection } from "../lib/list-sections";
import { previewSections } from "./list-page-preview";

/**
 * The pager's still page folds the Completed group by itself, because
 * it never mounts the live list. These cases pin the rows it draws.
 */

function task(name: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20", "alert weight": "harsh" },
    body: "",
  };
}

const sections: ListsSection[] = [
  { key: "Today", title: "Today", tone: "ink", data: [task("Pay rent")] },
  {
    key: "Completed",
    title: "Completed",
    tone: "faint",
    data: [task("Buy stamps"), task("Water the fern")],
  },
];

describe("the preview's Completed fold", () => {
  it("draws the header and no rows while the group is folded", () => {
    const drawn = previewSections(sections, 800, 0, false);

    expect(drawn.map(({ section }) => section.key)).toEqual([
      "Today",
      "Completed",
    ]);
    expect(drawn[1].data).toEqual([]);
  });

  it("draws the rows while the group is open", () => {
    const drawn = previewSections(sections, 800, 0, true);

    expect(drawn[1].data.map((item) => item.name)).toEqual([
      "Buy stamps",
      "Water the fern",
    ]);
  });
});
