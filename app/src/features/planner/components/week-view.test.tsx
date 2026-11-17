import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import type { WeekLayout } from "@/lib/settings";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { TestPlannerList } from "@/features/planner/testing/test-planner-list";
import { WeekView } from "./week-view";

function task(name: string, due: string): TaskItem {
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
      created: "2026-10-01",
      "alert weight": "harsh",
      due,
    },
  };
}

/** Monday 26 October 2026: the week runs Sunday 25 to Saturday 31. */
const monday = new Date(2026, 9, 26);

function mount(
  layout: WeekLayout,
  tasks: TaskItem[],
  handlers: {
    onSelect?: (day: Date) => void;
    onOpenDay?: (day: Date) => void;
    interactive?: boolean;
  } = {},
) {
  render(
    <PlanDrag.Root onDrop={() => undefined} renderGhost={() => null}>
      <TestPlannerList>
        <WeekView
          layout={layout}
          tasks={tasks}
          today={monday}
          selected={monday}
          interactive={handlers.interactive ?? true}
          onSelect={handlers.onSelect ?? (() => undefined)}
          onOpenDay={handlers.onOpenDay ?? (() => undefined)}
        />
      </TestPlannerList>
    </PlanDrag.Root>,
  );
}

/** Eight tasks on Tuesday 27, the day the week's busiest box draws. */
const eight = Array.from({ length: 8 }, (_, index) =>
  task(`Chore ${index + 1}`, `2026-10-27T${String(8 + index).padStart(2, "0")}:00`),
);

const layouts: WeekLayout[] = ["spread", "rows"];

describe("WeekView", () => {
  for (const layout of layouts) {
    describe(layout, () => {
      it("draws seven day presses", () => {
        mount(layout, eight);

        expect(
          screen.getAllByTestId(/^week-day:/).map((day) => day.getAttribute("data-testid")),
        ).toHaveLength(7);
        expect(screen.getByTestId("week-day:2026-10-27").textContent).toMatch(/^Tue\s*27/);
      });

      it("draws two chips and the hidden count when a day holds eight", () => {
        mount(layout, eight);

        const tuesday = screen.getByTestId("week-day:2026-10-27");
        expect(tuesday.textContent).toContain("Chore 1");
        expect(tuesday.textContent).toContain("Chore 2");
        expect(tuesday.textContent).not.toContain("Chore 3");
        // The count is its own press beside the day press, so the day's
        // name does not read it.
        expect(tuesday.textContent).not.toContain("+6");
        const more = screen.getByRole("button", {
          name: "+6 more on Tuesday 27, open the day",
        });
        expect(tuesday.parentElement?.contains(more)).toBe(true);
      });

      it("shows no count when a day's tasks all fit", () => {
        mount(layout, eight.slice(0, 2));

        const tuesday = screen.getByTestId("week-day:2026-10-27");
        expect(tuesday.textContent).toContain("Chore 2");
        expect(screen.queryByRole("button", { name: /open the day/ })).toBeNull();
      });

      it("opens the day when the count is pressed, and does not select it", () => {
        const onOpenDay = vi.fn();
        const onSelect = vi.fn();
        mount(layout, eight, { onOpenDay, onSelect });

        fireEvent.click(
          screen.getByRole("button", { name: "+6 more on Tuesday 27, open the day" }),
        );

        expect(onOpenDay).toHaveBeenCalledTimes(1);
        expect(onOpenDay.mock.calls[0][0]).toEqual(new Date(2026, 9, 27));
        // The press is the count's own: the box behind it does not select.
        expect(onSelect).not.toHaveBeenCalled();
      });

      it("selects the day when its box is pressed", () => {
        const onSelect = vi.fn();
        mount(layout, [], { onSelect });

        fireEvent.click(screen.getByTestId("week-day:2026-10-29"));

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0]).toEqual(new Date(2026, 9, 29));
      });
    });
  }

  it("draws the neighbour page without presses or drag chips", () => {
    mount("spread", eight, { interactive: false });

    expect(screen.queryAllByTestId(/^week-day:/)).toEqual([]);
    expect(screen.queryAllByTestId(/^week-task:/)).toEqual([]);
    expect(screen.getByText("+6")).toBeTruthy();
  });

  it("registers each chip as a drag source on the live page", () => {
    mount("rows", eight.slice(0, 1));

    expect(screen.getByTestId("week-task:Chore 1")).toBeTruthy();
  });
});
