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

  it("reports the checked state to the DOM", () => {
    // React Native Web drops `accessibilityState`, so the state must
    // travel as `aria-checked` to reach a screen reader on the web.
    const { rerender } = render(
      <TaskRow task={task("Buy milk")} onToggle={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "mark done" }).getAttribute("aria-checked"),
    ).toBe("false");

    rerender(<TaskRow task={task("Buy milk", { completed })} onToggle={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "mark not done" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("carries a test id named by its task", () => {
    render(<TaskRow task={task("Buy milk")} />);

    expect(screen.getByTestId("task-row:Buy milk")).toBeTruthy();
  });

  it("leaves the test id off a copy, so the id finds the live row only", () => {
    // A swipe preview and a drag ghost draw a second row for the same
    // task. Playwright fails at once when an id matches twice.
    render(
      <>
        <TaskRow task={task("Buy milk")} onToggle={vi.fn()} />
        <TaskRow task={task("Buy milk")} copy />
      </>,
    );

    expect(screen.getAllByTestId("task-row:Buy milk")).toHaveLength(1);
  });
});
