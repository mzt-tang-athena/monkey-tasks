import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { TestPlannerList } from "@/features/planner/testing/test-planner-list";
import { WeekView, weekChipCount } from "./week-view";

function task(name: string, due: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: { kind: "[[tasks]]", created: "2026-10-01", due },
  };
}

/** Monday 26 October 2026: the week runs Sunday 25 to Saturday 31. */
const monday = new Date(2026, 9, 26);

function mount(
  tasks: TaskItem[],
  handlers: { onSelect?: (day: Date) => void; onOpenDay?: (day: Date) => void } = {},
) {
  render(
    <PlanDrag.Root onDrop={() => undefined} renderGhost={() => null}>
      <TestPlannerList>
        <WeekView
          tasks={tasks}
          today={monday}
          selected={monday}
          onSelect={handlers.onSelect ?? (() => undefined)}
          onOpenDay={handlers.onOpenDay ?? (() => undefined)}
        />
      </TestPlannerList>
    </PlanDrag.Root>,
  );
}

const eight = Array.from({ length: 8 }, (_, index) =>
  task(`Chore ${index + 1}`, `2026-10-27T${String(8 + index).padStart(2, "0")}:00`),
);

describe("weekChipCount", () => {
  it("draws every chip while they fit", () => {
    expect(weekChipCount(0)).toBe(0);
    expect(weekChipCount(4)).toBe(4);
  });

  it("leaves room for the more line once they do not", () => {
    expect(weekChipCount(5)).toBe(3);
    expect(weekChipCount(8)).toBe(3);
  });
});

describe("WeekView", () => {
  it("shows every task when a column has room for all of them", () => {
    mount(eight.slice(0, 3));

    expect(screen.getAllByText(/Chore/)).toHaveLength(3);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it("shows the chips that fit and a +N more line when a column holds 8", () => {
    mount(eight);

    const shown = screen.getAllByText(/Chore/).length;
    const more = screen.getByText(/^\+\d+ more$/);
    expect(shown).toBeLessThan(8);
    expect(shown).toBeGreaterThan(0);
    expect(more.textContent).toBe(`+${8 - shown} more`);
  });

  it("opens that day when the +N more line is pressed", () => {
    const onOpenDay = vi.fn();
    const onSelect = vi.fn();
    mount(eight, { onOpenDay, onSelect });

    fireEvent.click(screen.getByText(/^\+\d+ more$/));

    expect(onOpenDay).toHaveBeenCalledTimes(1);
    expect(onOpenDay.mock.calls[0][0]).toEqual(new Date(2026, 9, 27));
    // The press is the line's own: the column behind it does not select.
    expect(onSelect).not.toHaveBeenCalled();
  });
});
