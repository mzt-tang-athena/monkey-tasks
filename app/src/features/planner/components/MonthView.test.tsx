import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import { MonthView } from "./MonthView";

function task(name: string, data: TaskFrontmatter): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
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

/** The day cells carrying a dot, in grid order. */
function dottedCells(): string[] {
  return screen
    .getAllByRole("button", { name: /^\w+day \d+$/ })
    .filter((cell) => within(cell).queryByTestId("month-dot") != null)
    .map((cell) => cell.getAttribute("aria-label") ?? "");
}

function mount(tasks: TaskItem[]) {
  render(
    <MonthView
      viewMonth={new Date(2026, 9, 1)}
      today={new Date(2026, 9, 1)}
      tasks={tasks}
      picked={null}
      onPick={() => undefined}
      onShiftMonth={() => undefined}
      dropZones={new DropZoneMap()}
      dragActive={false}
      hoveredDay={null}
    />,
  );
}

describe("MonthView grid", () => {
  it("renders every day of the month as a cell", () => {
    mount([]);
    // October 2026 has 31 days. Blank cells pad the grid but take no
    // role, so only the days answer.
    expect(screen.getAllByRole("button", { name: /^\w+day \d+$/ })).toHaveLength(31);
  });

  it("buckets one recurring task onto several days", () => {
    // October 2026 starts on a Thursday, so the grid is the whole
    // month: a daily rule from the 21st dots the 21st through the 31st.
    mount([
      task("standup", {
        kind: "[[tasks]]",
        created: "2026-10-01",
        due: "2026-10-21",
        recurrence: "FREQ=DAILY",
      }),
    ]);

    expect(dottedCells()).toEqual([
      "Wednesday 21",
      "Thursday 22",
      "Friday 23",
      "Saturday 24",
      "Sunday 25",
      "Monday 26",
      "Tuesday 27",
      "Wednesday 28",
      "Thursday 29",
      "Friday 30",
      "Saturday 31",
    ]);
  });

  it("keeps a non-recurring task on its own day", () => {
    mount([
      task("renew passport", {
        kind: "[[tasks]]",
        created: "2026-10-01",
        due: "2026-10-05",
      }),
    ]);

    expect(dottedCells()).toEqual(["Monday 5"]);
  });

  it("never dots a done recurring task", () => {
    mount([
      task("standup", {
        kind: "[[tasks]]",
        created: "2026-10-01",
        due: "2026-10-21",
        recurrence: "FREQ=DAILY",
        completed: "2026-10-21",
      }),
    ]);

    expect(dottedCells()).toEqual([]);
  });
});
