import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import { weekCells, weekChipCount, weekDays, weekLayouts, weekRows } from "./week-body";

function task(name: string, due: string, completed?: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: { kind: "[[tasks]]", created: "2026-10-01", due, ...(completed ? { completed } : {}) },
  };
}

/** Monday 26 October 2026: the week runs Sunday 25 to Saturday 31. */
const monday = new Date(2026, 9, 26);
const thursday = new Date(2026, 9, 29);

describe("weekChipCount", () => {
  it("draws every chip up to two", () => {
    expect(weekChipCount(0)).toBe(0);
    expect(weekChipCount(1)).toBe(1);
    expect(weekChipCount(2)).toBe(2);
  });

  it("draws two chips however many more the day holds", () => {
    expect(weekChipCount(3)).toBe(2);
    expect(weekChipCount(8)).toBe(2);
  });
});

describe("weekDays", () => {
  it("lists the selected day's week from Sunday to Saturday", () => {
    const days = weekDays({ tasks: [], selected: thursday, today: monday });

    expect(days.map((day) => day.iso)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });

  it("marks today and the selected day", () => {
    const days = weekDays({ tasks: [], selected: thursday, today: monday });

    expect(days.filter((day) => day.isToday).map((day) => day.iso)).toEqual(["2026-10-26"]);
    expect(days.filter((day) => day.isSelected).map((day) => day.iso)).toEqual(["2026-10-29"]);
  });

  it("puts each open task on its day in time order and leaves done ones out", () => {
    const tasks = [
      task("Evening", "2026-10-27T19:00"),
      task("Morning", "2026-10-27T08:00"),
      task("Done", "2026-10-27T09:00", "2026-10-27T09:30"),
      task("Saturday", "2026-10-31"),
    ];

    const days = weekDays({ tasks, selected: monday, today: monday });

    expect(days[2].items.map((item) => item.name)).toEqual(["Morning", "Evening"]);
    expect(days[6].items.map((item) => item.name)).toEqual(["Saturday"]);
    expect(days[0].items).toEqual([]);
  });
});

describe("weekLayouts", () => {
  it("gives every day a cell in both layouts", () => {
    for (const geometry of Object.values(weekLayouts)) {
      expect(geometry.cells).toHaveLength(geometry.columns * geometry.rows);
      expect(new Set(geometry.cells)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
    }
  });

  it("pairs the days in Spread and lays Saturday across the last row", () => {
    const rows = weekRows(weekLayouts.spread);

    expect(rows.map((row) => row.map((slot) => slot.day))).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
      [6],
    ]);
    expect(rows[3][0]).toEqual({ day: 6, span: 2, cell: 6 });
  });

  it("stacks the seven days in Rows", () => {
    const rows = weekRows(weekLayouts.rows);

    expect(rows.map((row) => row.map((slot) => slot.day))).toEqual([
      [0],
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
    ]);
  });

  it("gives Saturday's two Spread cells the same target", () => {
    const targets = ["sun", "mon", "tue", "wed", "thu", "fri", { iso: "sat" }];

    const cells = weekCells(weekLayouts.spread, targets);

    expect(cells.slice(0, 6)).toEqual(["sun", "mon", "tue", "wed", "thu", "fri"]);
    expect(cells[6]).toBe(targets[6]);
    expect(cells[7]).toBe(targets[6]);
  });
});
