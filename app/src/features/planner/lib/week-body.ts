import type { TaskItem } from "@/types/task";
import type { WeekLayout } from "@/lib/settings";
import { addDays, isoOf, isSameDay } from "@/utils/dates";
import { spacing, touchTarget } from "@/theme/tokens";
import { startOfWeek, tasksForDay } from "@/features/planner/model";
import { sortDay } from "./day-rows";

/*
 * The week body as data. Both layouts draw the same seven days, and a
 * table says where each day sits in the drop grid. The live week, the
 * swipe preview and the tests all read these functions.
 */

/** One day of the week body, with its open tasks in the order the day
    runs. */
export type WeekDay = {
  date: Date;
  iso: string;
  isToday: boolean;
  isSelected: boolean;
  items: TaskItem[];
};

/** The seven days of the selected day's week, Sunday first. */
export function weekDays({
  tasks,
  selected,
  today,
}: {
  tasks: TaskItem[];
  selected: Date;
  today: Date;
}): WeekDay[] {
  const start = startOfWeek(selected);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(start, offset);
    return {
      date,
      iso: isoOf(date),
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, selected),
      items: sortDay(tasksForDay(tasks, date)),
    };
  });
}

/**
 * How many chips of `count` a day draws. Every chip has one fixed
 * height, so a box holds a known number of them (ADR 0041). The "+N"
 * count sits beside the chips, not under them, so it takes no chip.
 */
export function weekChipCount(count: number): number {
  return Math.min(count, 2);
}

/** What differs between the layouts: the drop grid's shape, which day
    owns each grid cell, and the grid's height in points. */
export type WeekGeometry = {
  columns: number;
  rows: number;
  /** One entry per grid cell, left to right and top to bottom: the
      index of the day that owns it. A day may own more than one. */
  cells: readonly number[];
  height: number;
};

/** A Spread box: a 4pt pad, the 14pt header line, two 18pt chips 4pt
    apart, and room for the hairline border, on the 4pt grid. */
export const spreadBox = { height: 68, gap: spacing.s, header: 14, chip: 18 } as const;

/** A Rows line: one touch target tall. */
export const rowsLine = { height: touchTarget, chip: 24, date: 36 } as const;

export const weekLayouts: Record<WeekLayout, WeekGeometry> = {
  // Sunday with Monday, Tuesday with Wednesday, Thursday with Friday,
  // and Saturday across both columns of the last row.
  spread: {
    columns: 2,
    rows: 4,
    cells: [0, 1, 2, 3, 4, 5, 6, 6],
    height: 4 * spreadBox.height + 3 * spreadBox.gap,
  },
  rows: {
    columns: 1,
    rows: 7,
    cells: [0, 1, 2, 3, 4, 5, 6],
    height: 7 * rowsLine.height,
  },
};

/** One box in a grid row: the day it draws, how many cells it spans,
    and the first cell it owns. */
export type WeekSlot = { day: number; span: number; cell: number };

/** The layout's grid rows, with each run of cells one day owns merged
    into one box. */
export function weekRows(geometry: WeekGeometry): WeekSlot[][] {
  const rows: WeekSlot[][] = [];
  for (let row = 0; row < geometry.rows; row += 1) {
    const slots: WeekSlot[] = [];
    for (let column = 0; column < geometry.columns; column += 1) {
      const cell = row * geometry.columns + column;
      const day = geometry.cells[cell];
      const last = slots.at(-1);
      if (last !== undefined && last.day === day) {
        last.span += 1;
      } else {
        slots.push({ day, span: 1, cell });
      }
    }
    rows.push(slots);
  }
  return rows;
}

/** The drop grid's cells: each cell holds its day's target. Cells one
    day owns hold the same object, so a hover on either rings one box. */
export function weekCells<T>(geometry: WeekGeometry, targets: readonly T[]): T[] {
  return geometry.cells.map((day) => targets[day]);
}
