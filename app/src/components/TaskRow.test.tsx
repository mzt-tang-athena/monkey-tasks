import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/features/tasks/query";
import { TaskRow } from "./TaskRow";

function task(name: string, extra: Partial<TaskFrontmatter> = {}): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20", ...extra },
    body: "",
  };
}

const completed = "2026-10-25T10:00:00";

describe("TaskRow", () => {
  it("opens the task from the body and still toggles from the circle", () => {
    const item = task("Buy milk");
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(<TaskRow task={item} onOpen={onOpen} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "open task" }));
    expect(onOpen).toHaveBeenCalledWith(item);
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "mark done" }));
    expect(onToggle).toHaveBeenCalledWith(item);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the check as soon as the data says done", () => {
    // The store is optimistic: it flips the row's data in the same
    // frame as the tap, so the row reads the data and nothing else.
    const { rerender } = render(
      <TaskRow task={task("Buy milk")} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "mark done" })).toBeTruthy();
    expect(screen.queryByText("✓")).toBeNull();

    rerender(<TaskRow task={task("Buy milk", { completed })} onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: "mark not done" })).toBeTruthy();
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("returns to an empty circle when the data says not done", () => {
    const { rerender } = render(
      <TaskRow task={task("Buy milk", { completed })} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "mark not done" })).toBeTruthy();

    rerender(<TaskRow task={task("Buy milk")} onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: "mark done" })).toBeTruthy();
    expect(screen.queryByText("✓")).toBeNull();
  });
});
