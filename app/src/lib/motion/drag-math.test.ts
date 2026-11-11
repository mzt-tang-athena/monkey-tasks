import { describe, expect, it } from "vitest";
import {
  cardPosition,
  dropSpan,
  hitZone,
  slotForY,
  slotIndexes,
  slotTops,
  type GridRect,
  type ZoneRect,
} from "./drag-math";

const rows = [
  { top: 100, height: 40 },
  { top: 148, height: 60 },
  { top: 216, height: 40 },
];

describe("slotForY", () => {
  it("finds the row under the finger at each boundary", () => {
    expect(slotForY(100, rows)).toBe(0);
    expect(slotForY(147.9, rows)).toBe(0);
    expect(slotForY(148, rows)).toBe(1);
    expect(slotForY(215.9, rows)).toBe(1);
    expect(slotForY(216, rows)).toBe(2);
  });

  it("clamps above the first row and below the last", () => {
    expect(slotForY(-500, rows)).toBe(0);
    expect(slotForY(9000, rows)).toBe(2);
  });
});

describe("slotTops", () => {
  it("lays the new order out from the first top, with the gap", () => {
    // Row 2 moves to the top: it takes the first top, and the others
    // follow with their own heights.
    expect(slotTops([2, 0, 1], rows, 8)).toEqual([148, 196, 100]);
  });

  it("keeps the measured tops for the same order", () => {
    expect(slotTops([0, 1, 2], rows, 8)).toEqual([100, 148, 216]);
  });
});

describe("dropSpan", () => {
  it("reads a full group's mount positions as its data indexes", () => {
    expect(dropSpan(1, 3, [0, 1, 2, 3])).toEqual({ from: 1, to: 3 });
    expect(dropSpan(1, 0, [0, 1, 2, 3])).toEqual({ from: 1, to: 0 });
  });

  it("reads a scrolled group's mount positions by their data indexes", () => {
    // The group's first rows are off screen, so mount position 0 holds
    // data index 3.
    expect(dropSpan(1, 0, [3, 4])).toEqual({ from: 4, to: 3 });
    expect(dropSpan(0, 1, [3, 4])).toEqual({ from: 3, to: 4 });
    expect(dropSpan(0, 2, [3, 4])).toEqual({ from: 3, to: 5 });
  });

  it("has no span with no mounted row", () => {
    expect(dropSpan(0, 0, [])).toBeNull();
    expect(dropSpan(-1, 0, [3, 4])).toBeNull();
    expect(dropSpan(2, 0, [3, 4])).toBeNull();
  });
});

describe("slotIndexes", () => {
  it("moves each row's data index the way the mount order moves", () => {
    expect(slotIndexes(1, 3, [0, 1, 2, 3])).toEqual([0, 2, 1, 3]);
    expect(slotIndexes(3, 0, [0, 1, 2, 3])).toEqual([1, 2, 3, 0]);
    expect(slotIndexes(1, 1, [0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
  });

  it("starts from the mounted rows' own data indexes", () => {
    expect(slotIndexes(1, 0, [3, 4])).toEqual([4, 3]);
    expect(slotIndexes(0, 2, [3, 4])).toEqual([4, 3]);
  });

  it("leaves every index be with no picked row", () => {
    expect(slotIndexes(-1, 0, [3, 4])).toEqual([3, 4]);
  });
});

const zone = (id: number, x: number, y: number, clip = -1): ZoneRect => ({
  id,
  x,
  y,
  width: 100,
  height: 50,
  clip,
});

describe("hitZone", () => {
  it("finds the zone under the finger", () => {
    const zones = [zone(1, 0, 0), zone(2, 0, 60)];
    expect(hitZone(50, 70, zones, [], {})).toEqual({ id: 2, cell: -1 });
    expect(hitZone(50, 55, zones, [], {})).toBeNull();
  });

  it("misses a zone outside its clip", () => {
    const zones = [zone(1, 0, 300, 7)];
    const clips = { 7: { x: 0, y: 0, width: 400, height: 320 } };
    expect(hitZone(50, 310, zones, [], clips)).toEqual({ id: 1, cell: -1 });
    expect(hitZone(50, 330, zones, [], clips)).toBeNull();
  });

  it("picks the smaller of two nested zones", () => {
    const outer: ZoneRect = { id: 1, x: 0, y: 0, width: 400, height: 400, clip: -1 };
    expect(hitZone(10, 10, [outer, zone(2, 0, 0)], [], {})).toEqual({ id: 2, cell: -1 });
    expect(hitZone(10, 300, [outer, zone(2, 0, 0)], [], {})).toEqual({ id: 1, cell: -1 });
  });

  const grid: GridRect = {
    id: 9,
    x: 0,
    y: 0,
    width: 70,
    height: 20,
    clip: -1,
    columns: 7,
    rows: 2,
    cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, null],
  };

  it("finds a grid cell at each edge", () => {
    expect(hitZone(0, 0, [], [grid], {})).toEqual({ id: 9, cell: 0 });
    expect(hitZone(9.99, 9.99, [], [grid], {})).toEqual({ id: 9, cell: 0 });
    expect(hitZone(10, 0, [], [grid], {})).toEqual({ id: 9, cell: 1 });
    expect(hitZone(69.9, 0, [], [grid], {})).toEqual({ id: 9, cell: 6 });
    expect(hitZone(0, 10, [], [grid], {})).toEqual({ id: 9, cell: 7 });
    expect(hitZone(70, 0, [], [grid], {})).toBeNull();
  });

  it("finds no target on a null cell", () => {
    expect(hitZone(65, 15, [], [grid], {})).toBeNull();
  });
});

describe("cardPosition", () => {
  it("places first, middle, last and only", () => {
    expect(cardPosition(0, 3)).toBe("first");
    expect(cardPosition(1, 3)).toBe("middle");
    expect(cardPosition(2, 3)).toBe("last");
    expect(cardPosition(0, 1)).toBe("only");
  });
});
