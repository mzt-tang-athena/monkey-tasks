import { describe, expect, it } from "vitest";
import {
  filterCommands,
  orderCommands,
  recordRecent,
  type Command,
} from "./model";

function command(id: string, label = id): Command {
  return { id, label, run: () => {} };
}

const all = [
  command("capture", "Add task"),
  command("lists", "Go to Lists"),
  command("planner", "Go to Planner"),
  command("sort", "Sort mode"),
  command("theme", "Theme"),
  command("settings", "Settings"),
  command("diagnostics", "Diagnostics"),
];

describe("filterCommands", () => {
  it("matches the label whatever the case", () => {
    expect(filterCommands(all, "PLAN").map((item) => item.id)).toEqual(["planner"]);
  });

  it("matches a hint and a keyword", () => {
    const rows = [
      { ...command("theme", "Theme"), hint: "Appearance", keywords: ["palette"] },
      { ...command("sort", "Sort mode"), hint: "Due date" },
    ];
    expect(filterCommands(rows, "appear").map((item) => item.id)).toEqual(["theme"]);
    expect(filterCommands(rows, "palette").map((item) => item.id)).toEqual(["theme"]);
    expect(filterCommands(rows, "due").map((item) => item.id)).toEqual(["sort"]);
  });

  it("keeps every command for an empty query", () => {
    expect(filterCommands(all, "  ")).toEqual(all);
  });

  it("finds nothing for a query no command carries", () => {
    expect(filterCommands(all, "journal")).toEqual([]);
  });
});

describe("orderCommands", () => {
  it("puts the recent commands first, most recent first", () => {
    expect(orderCommands(all, ["settings", "capture"]).map((item) => item.id)).toEqual([
      "settings",
      "capture",
      "lists",
      "planner",
      "sort",
      "theme",
      "diagnostics",
    ]);
  });

  it("drops a recent id that no longer names a command", () => {
    expect(orderCommands(all, ["gone", "theme"]).map((item) => item.id).slice(0, 2)).toEqual([
      "theme",
      "capture",
    ]);
  });

  it("keeps at most 12 rows", () => {
    const many = Array.from({ length: 15 }, (_, at) => command(`c${at}`));
    expect(orderCommands(many, [])).toHaveLength(12);
    expect(orderCommands(many, ["c14"])[0].id).toBe("c14");
  });
});

describe("recordRecent", () => {
  it("moves the command to the front without a duplicate", () => {
    expect(recordRecent(["lists", "planner"], "planner")).toEqual(["planner", "lists"]);
  });

  it("keeps the newest five", () => {
    expect(recordRecent(["a", "b", "c", "d", "e"], "f")).toEqual([
      "f",
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});
