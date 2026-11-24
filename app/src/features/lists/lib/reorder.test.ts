import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { rebaseSpan, reorderItems } from "./reorder";

function task(name: string, order?: number): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  const data: TaskFrontmatter = {
    kind: "[[tasks]]",
    created: "2026-10-20",
    "alert weight": "harsh",
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

  it("renumbers the tab from the top to the end and back", () => {
    const items = [task("A"), task("B"), task("C"), task("D")];

    expect(names(reorderItems(items, 0, items.length))).toEqual([
      ["B", 1],
      ["C", 2],
      ["D", 3],
      ["A", 4],
    ]);

    const ordered = [task("B", 1), task("C", 2), task("D", 3), task("A", 4)];

    expect(names(reorderItems(ordered, 3, 0))).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
    ]);
  });

  it("writes only the rows whose number changed", () => {
    const ordered = [task("A", 1), task("B", 2), task("C", 3), task("D", 4)];

    expect(names(reorderItems(ordered, 1, 3))).toEqual([
      ["C", 2],
      ["B", 3],
    ]);
  });
});

const keys = ["Alpha", "Bravo", "Charlie", "Delta"];
const unchanged = { Alpha: 0, Bravo: 1, Charlie: 2, Delta: 3 };

describe("rebaseSpan", () => {
  it("keeps the pickup's own span when nothing changed", () => {
    expect(rebaseSpan(1, 3, keys, unchanged)).toEqual({ from: 1, to: 3 });
    expect(rebaseSpan(1, 0, keys, unchanged)).toEqual({ from: 1, to: 0 });
    expect(rebaseSpan(2, 4, keys, unchanged)).toEqual({ from: 2, to: 4 });
  });

  it("reads the pickup keys against the group as it stands at the drop", () => {
    // Bravo left the group while Delta was held. Delta now sits at 2,
    // so the drop writes 2 -> 0 instead of the pickup's 3 -> 0.
    expect(rebaseSpan(3, 0, keys, { Alpha: 0, Charlie: 1, Delta: 2 })).toEqual({
      from: 2,
      to: 0,
    });
  });

  it("lands after the nearest row above a boundary that left", () => {
    // The drop was before Charlie, and Charlie left: it lands after
    // Bravo, which is where Charlie stood.
    expect(rebaseSpan(0, 2, keys, { Alpha: 0, Bravo: 1, Delta: 2 })).toEqual({
      from: 0,
      to: 2,
    });
  });

  it("reads a scrolled group by the rows it mounted", () => {
    expect(rebaseSpan(1, 0, ["Delta", "Echo"], { Charlie: 2, Delta: 3, Echo: 4 })).toEqual({
      from: 4,
      to: 3,
    });
  });

  it("cancels when the picked row left the group", () => {
    expect(rebaseSpan(1, 3, keys, { Alpha: 0, Charlie: 2, Delta: 3 })).toBeNull();
  });

  it("cancels when the rows no longer stand in their pickup order", () => {
    // A step under the drag moved Charlie above Bravo.
    expect(rebaseSpan(3, 0, keys, { Alpha: 0, Charlie: 1, Bravo: 2, Delta: 3 })).toBeNull();
  });

  it("cancels with no picked row", () => {
    expect(rebaseSpan(0, 0, [], {})).toBeNull();
    expect(rebaseSpan(-1, 0, keys, unchanged)).toBeNull();
    expect(rebaseSpan(4, 0, keys, unchanged)).toBeNull();
  });
});
