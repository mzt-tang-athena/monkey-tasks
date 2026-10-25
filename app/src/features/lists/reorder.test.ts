import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../tasks/query";
import { reorderItems } from "./reorder";

function task(name: string, order?: number): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  const data: TaskFrontmatter = {
    kind: "[[tasks]]",
    created: "2026-10-20",
    ...(order == null ? {} : { order }),
  };
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data,
  };
}

const names = (changes: { task: TaskItem; order: number }[]) =>
  changes.map((change) => [change.task.name, change.order]);

describe("reorderItems", () => {
  it("moves an item up and renumbers the sequence", () => {
    const items = [task("A", 1), task("B", 2), task("C", 3)];

    expect(names(reorderItems(items, 2, 0))).toEqual([
      ["C", 1],
      ["A", 2],
      ["B", 3],
    ]);
  });

  it("moves an item down and renumbers the ones it passes", () => {
    const items = [task("A", 1), task("B", 2), task("C", 3), task("D", 4)];

    expect(names(reorderItems(items, 0, 2))).toEqual([
      ["B", 1],
      ["A", 2],
    ]);
  });

  it("writes nothing when the item stays where it is", () => {
    const items = [task("A", 1), task("B", 2), task("C", 3)];

    expect(reorderItems(items, 1, 1)).toEqual([]);
    expect(reorderItems(items, 1, 2)).toEqual([]);
  });

  it("numbers tasks that had no order", () => {
    const items = [task("A", 1), task("B"), task("C")];

    expect(names(reorderItems(items, 0, 2))).toEqual([
      ["B", 1],
      ["A", 2],
      ["C", 3],
    ]);
  });
});
