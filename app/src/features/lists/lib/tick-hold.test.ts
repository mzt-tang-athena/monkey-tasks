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

describe("applyTickHold", () => {
  it("returns the groups as they are when nothing is held", () => {
    const sections = [group("Today", [task("A")])];

    expect(applyTickHold(sections, null, [])).toBe(sections);
  });

  it("returns the groups as they are when the held row is not done", () => {
    const sections = [group("Today", [task("A")])];
    const hold: TickHold = {
      uri: task("A").uri,
      section: "Today",
      tone: "ink",
      sectionIndex: 0,
      index: 0,
    };

    expect(applyTickHold(sections, hold, [task("A")])).toBe(sections);
  });

  it("puts a held row back in its own group, at its own place", () => {
    const b = task("B", done);
    // The tick moved B into Completed. Its group still holds A and C.
    const sections = [
      group("Today", [task("A"), task("C")]),
      group("Completed", [b], "faint"),
    ];
    const hold: TickHold = {
      uri: b.uri,
      section: "Today",
      tone: "muted",
      sectionIndex: 0,
      index: 1,
    };

    const next = applyTickHold(sections, hold, [b]);

    expect(names(next)).toEqual(["Today:A,B,C"]);
  });

  it("brings back a group that left, at the place it held", () => {
    const a = task("A", done);
    // A was the only row in Today. The tick emptied the group and made
    // Completed. No Today group is left to splice into.
    const sections = [
      group("No date", [task("B")]),
      group("Completed", [a], "faint"),
    ];
    const hold: TickHold = {
      uri: a.uri,
      section: "Today",
      tone: "ink",
      sectionIndex: 0,
      index: 0,
    };

    const next = applyTickHold(sections, hold, [a]);

    expect(names(next)).toEqual(["Today:A", "No date:B"]);
    expect(next[0].tone).toBe("ink");
  });

  it("keeps Completed when it holds other rows", () => {
    const a = task("A", done);
    const old = task("Old", done);
    const sections = [group("Completed", [a, old], "faint")];
    const hold: TickHold = {
      uri: a.uri,
      section: "Today",
      tone: "ink",
      sectionIndex: 0,
      index: 0,
    };

    expect(names(applyTickHold(sections, hold, [a, old]))).toEqual([
      "Today:A",
      "Completed:Old",
    ]);
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
      index: 1,
    });
  });

  it("holds nothing for a row in Completed", () => {
    const a = task("A", done);

    expect(startTickHold([group("Completed", [a], "faint")], a)).toBeNull();
  });
});
