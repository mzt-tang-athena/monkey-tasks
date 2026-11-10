import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import {
  TestPlannerList,
  testToday,
} from "@/features/planner/testing/test-planner-list";
import { DayPreview } from "./day-preview";

function task(name: string, data: TaskFrontmatter): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return { id: uri, uri, fileName: `${name}.md`, name, text: "", body: "", data };
}

/** A weekly task stored on Tuesday 20 October: it occurs on Tuesday
    27 October, though no note carries that date. */
const weekly = task("Water the plants", {
  kind: "[[tasks]]",
  created: "2026-10-01",
  due: "2026-10-20",
  recurrence: "FREQ=WEEKLY",
});

function preview(tasks: TaskItem[]) {
  render(
    <TestPlannerList>
      <DayPreview
        date={new Date(2026, 9, 27)}
        today={testToday}
        tasks={tasks}
        now={new Date(2026, 9, 27, 9, 5)}
        fraction={0.51}
      />
    </TestPlannerList>,
  );
}

/** The names of the preview's list rows, top to bottom. */
function listed(): string[] {
  return screen
    .getAllByText(/^(Supplements|Dentist appointment|Water the plants)$/)
    .map((node) => node.textContent ?? "");
}

describe("DayPreview", () => {
  it("lists a recurrence that falls on the day, as the live day does", () => {
    preview([weekly]);

    expect(screen.getByText("Water the plants")).toBeTruthy();
  });

  it("sorts a recurring task by its time of day, not its stored day", () => {
    const evening = task("Supplements", {
      kind: "[[tasks]]",
      created: "2026-10-01",
      due: "2026-10-26T19:00",
      recurrence: "FREQ=DAILY",
    });
    const afternoon = task("Dentist appointment", {
      kind: "[[tasks]]",
      created: "2026-10-01",
      due: "2026-10-27T14:30",
    });
    preview([evening, afternoon]);

    // The ruler lists the timed tasks too, so compare the last two
    // names: the list pane's rows.
    const names = listed();
    expect(names.slice(-2)).toEqual(["Dentist appointment", "Supplements"]);
  });
});
