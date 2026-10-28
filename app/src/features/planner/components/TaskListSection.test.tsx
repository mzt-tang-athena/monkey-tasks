import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { TaskListSection } from "./TaskListSection";

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

const baseProps = {
  source: "due-period",
  mode: "day",
  sourceMenuOpen: false,
  onCycleSource: () => undefined,
  onOpenSourceMenu: () => undefined,
  taskForm: "rows",
  onFormChange: () => undefined,
  onDragStart: () => undefined,
  emptyLabel: "Nothing due today",
} as const;

function mount(
  tasks: TaskItem[],
  onToggle: (task: TaskItem) => void = () => undefined,
) {
  render(<TaskListSection {...baseProps} tasks={tasks} onToggle={onToggle} />);
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

    const circles = screen.getAllByRole("button", { name: "mark done" });
    expect(circles).toHaveLength(2);

    fireEvent.click(circles[0]);
    expect(onToggle).toHaveBeenLastCalledWith(tasks[0]);

    fireEvent.click(circles[1]);
    expect(onToggle).toHaveBeenLastCalledWith(tasks[1]);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
