import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import type { ListsSection } from "./list-sections";
import { applyTickHold, startTickHold, type TickHold } from "./tick-hold";

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

function group(
  key: string,
  data: TaskItem[],
  tone: ListsSection["tone"] = "muted",
): ListsSection {
  return { key, title: key, tone, data };
}

const done = "2026-10-26T10:00:00";
const names = (sections: ListsSection[]) =>
  sections.map((s) => `${s.key}:${s.data.map((t) => t.name).join(",")}`);

function hold(
  target: TaskItem,
  section: string,
  sectionIndex: number,
  index: number,
  tone: ListsSection["tone"] = "muted",
  after: TaskItem | null = null,
  before: TaskItem | null = null,
): TickHold {
  return {
    uri: target.uri,
    section,
    tone,
    sectionIndex,
    after: after?.uri ?? null,
    before: before?.uri ?? null,
    index,
  };
}

describe("applyTickHold", () => {
  it("returns the groups as they are when nothing is held", () => {
    const sections = [group("Today", [task("A")])];

    expect(applyTickHold(sections, [], [])).toBe(sections);
  });

  it("returns the groups as they are when the held row is not done", () => {
    const sections = [group("Today", [task("A")])];
    const held = hold(task("A"), "Today", 0, 0, "ink");

    expect(applyTickHold(sections, [held], [task("A")])).toBe(sections);
  });

  it("puts a held row back in its own group, at its own place", () => {
    const b = task("B", done);
    // The tick moved B into Completed. Its group still holds A and C.
    const sections = [
      group("Today", [task("A"), task("C")]),
      group("Completed", [b], "faint"),
    ];
    const held = hold(b, "Today", 0, 1);

    const next = applyTickHold(sections, [held], [b]);

    expect(names(next)).toEqual(["Today:A,B,C"]);
  });

  it("holds a row completed with a date alone", () => {
    const b = task("B", "2026-10-26");
    const sections = [
      group("Today", [task("A")]),
      group("Completed", [b], "faint"),
    ];
    const held = hold(b, "Today", 0, 1);

    expect(names(applyTickHold(sections, [held], [b]))).toEqual([
      "Today:A,B",
    ]);
  });

  it("brings back a group that left, at the place it held", () => {
    const a = task("A", done);
    // A was the only row in Today. The tick emptied the group and made
    // Completed. No Today group is left to splice into.
    const sections = [
      group("No date", [task("B")]),
      group("Completed", [a], "faint"),
    ];
    const held = hold(a, "Today", 0, 0, "ink");

    const next = applyTickHold(sections, [held], [a]);

    expect(names(next)).toEqual(["Today:A", "No date:B"]);
    expect(next[0].tone).toBe("ink");
  });

  it("keeps Completed when it holds other rows", () => {
    const a = task("A", done);
    const old = task("Old", done);
    const sections = [group("Completed", [a, old], "faint")];
    const held = hold(a, "Today", 0, 0, "ink");

    expect(names(applyTickHold(sections, [held], [a, old]))).toEqual([
      "Today:A",
      "Completed:Old",
    ]);
  });

  it("puts two held rows back, so a second tick never moves the first", () => {
    const a = task("A", done);
    const b = task("B", done);
    // A and B were adjacent in Today, which now holds only C.
    const sections = [
      group("Today", [task("C")]),
      group("Completed", [a, b], "faint"),
    ];
    const holds = [hold(a, "Today", 0, 0), hold(b, "Today", 0, 1)];

    expect(names(applyTickHold(sections, holds, [a, b, task("C")]))).toEqual([
      "Today:A,B,C",
    ]);
  });

  it("places three holds in their own order", () => {
    const a = task("A", done);
    const b = task("B", done);
    const c = task("C", done);
    const sections = [
      group("No date", [task("D")]),
      group("Completed", [a, b, c], "faint"),
    ];
    const holds = [
      hold(a, "Today", 0, 0, "ink"),
      hold(b, "Today", 0, 1, "ink"),
      hold(c, "Today", 0, 2, "ink"),
    ];

    expect(
      names(applyTickHold(sections, holds, [a, b, c, task("D")])),
    ).toEqual(["Today:A,B,C", "No date:D"]);
  });

  it("applies holds in their own order whatever order they were ticked", () => {
    const a = task("A", done);
    const b = task("B", done);
    const c = task("C", done);
    const sections = [
      group("Today", []),
      group("No date", [task("D")]),
      group("Completed", [a, b, c], "faint"),
    ];
    const holds = [
      hold(c, "Today", 0, 2, "ink"),
      hold(a, "Today", 0, 0, "ink"),
      hold(b, "Today", 0, 1, "ink"),
    ];

    expect(
      names(applyTickHold(sections, holds, [a, b, c, task("D")])),
    ).toEqual(["Today:A,B,C", "No date:D"]);
  });

  it("keeps a held row by its lower neighbour when the row above leaves", () => {
    const b = task("B", done);
    const c = task("C");
    // A, B and C sat together. A ticked first and left; B is still
    // held at the place it had, which now rests against C.
    const sections = [group("Today", [c])];
    const holds = [hold(b, "Today", 0, 1, "muted", task("A"), c)];

    expect(names(applyTickHold(sections, holds, [b, c]))).toEqual([
      "Today:B,C",
    ]);
  });

  it("keeps holds from two groups in each group", () => {
    const a = task("A", done);
    const b = task("B", done);
    const sections = [
      group("No date", [task("C")]),
      group("Completed", [a, b], "faint"),
    ];
    const holds = [hold(a, "Today", 0, 0, "ink"), hold(b, "No date", 1, 0)];

    expect(
      names(applyTickHold(sections, holds, [a, b, task("C")])),
    ).toEqual(["Today:A", "No date:B,C"]);
  });
});

describe("startTickHold", () => {
  it("reads the group and the place of an open row", () => {
    const sections = [
      group("Today", [task("A")]),
      group("No date", [task("B"), task("C")]),
    ];

    expect(startTickHold(sections, task("C"))).toEqual({
      uri: task("C").uri,
      section: "No date",
      tone: "muted",
      sectionIndex: 1,
      after: task("B").uri,
      before: null,
      index: 1,
    });
  });

  it("holds nothing for a row in Completed", () => {
    const a = task("A", done);

    expect(startTickHold([group("Completed", [a], "faint")], a)).toBeNull();
  });
});
