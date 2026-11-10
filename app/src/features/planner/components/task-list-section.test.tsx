import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { TestPlannerList } from "@/features/planner/testing/test-planner-list";
import { TaskListSection } from "./task-list-section";

function task(name: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20" },
    body: "",
  };
}

function mount(
  tasks: TaskItem[],
  toggle: (task: TaskItem) => void = () => undefined,
) {
  render(
    <PlanDrag.Root onDrop={() => undefined} renderGhost={() => null}>
      <TestPlannerList value={{ toggle }}>
        <TaskListSection
          mode="day"
          day={new Date(2026, 9, 26)}
          tasks={tasks}
          emptyLabel="Nothing due today"
        />
      </TestPlannerList>
    </PlanDrag.Root>,
  );
}

describe("TaskListSection", () => {
  it("renders both task names", () => {
    mount([task("Buy milk"), task("Call the plumber")]);

    expect(screen.getByText("Buy milk")).toBeTruthy();
    expect(screen.getByText("Call the plumber")).toBeTruthy();
    expect(screen.queryByText("Nothing due today")).toBeNull();
  });

  it("shows the empty label when the task list is empty", () => {
    mount([]);

    expect(screen.getByText("Nothing due today")).toBeTruthy();
  });

  it("toggles the row whose circle was pressed", () => {
    const tasks = [task("Buy milk"), task("Call the plumber")];
    const onToggle = vi.fn();
    mount(tasks, onToggle);

    const first = screen.getByRole("checkbox", { name: "Buy milk" });
    const second = screen.getByRole("checkbox", { name: "Call the plumber" });

    fireEvent.click(first);
    expect(onToggle).toHaveBeenLastCalledWith(tasks[0]);

    fireEvent.click(second);
    expect(onToggle).toHaveBeenLastCalledWith(tasks[1]);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
