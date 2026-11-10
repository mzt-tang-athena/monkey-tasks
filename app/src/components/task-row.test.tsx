import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { TaskRow } from "./task-row";

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

    fireEvent.click(screen.getByRole("button", { name: "Buy milk" }));
    expect(onOpen).toHaveBeenCalledWith(item);
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Buy milk" }));
    expect(onToggle).toHaveBeenCalledWith(item);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("names the row body with the task and its meta", () => {
    const item = task("Buy milk", { due: "2026-10-20T15:00" });
    render(<TaskRow task={item} onOpen={vi.fn()} onToggle={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Buy milk, 3:00 PM, overdue" }),
    ).toBeTruthy();
  });

  it("shows the check as soon as the data says done", () => {
    // The store is optimistic: it flips the row's data in the same
    // frame as the tap, so the row reads the data and nothing else.
    const { rerender } = render(
      <TaskRow task={task("Buy milk")} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox", { name: "Buy milk" })).toBeTruthy();
    expect(screen.queryByText("✓")).toBeNull();

    rerender(<TaskRow task={task("Buy milk", { completed })} onToggle={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Buy milk" })).toBeTruthy();
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("stays at rest when a tap never reaches the data", () => {
    // A write that fails at once rolls the tick back before the row
    // renders it. The row then never sees its data change, and must not
    // keep a half-played tick: a wash over it, a shrunken circle.
    const { container } = render(
      <TaskRow task={task("Buy milk")} onToggle={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Buy milk" }));

    const styles = [...container.querySelectorAll<HTMLElement>("*")].map(
      (element) => element.style,
    );
    expect(styles.filter((style) => style.opacity === "0.9")).toEqual([]);
    expect(
      styles.filter((style) => style.transform.includes("scale(0.9)")),
    ).toEqual([]);
  });

  it("returns to an empty circle when the data says not done", () => {
    const { rerender } = render(
      <TaskRow task={task("Buy milk", { completed })} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox", { name: "Buy milk" })).toBeTruthy();

    rerender(<TaskRow task={task("Buy milk")} onToggle={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Buy milk" })).toBeTruthy();
    expect(screen.queryByText("✓")).toBeNull();
  });

  it("reports the checked state to the DOM", () => {
    // React Native Web drops the accessibility state object. The state
    // must travel as `aria-checked` to reach a screen reader on the web.
    const { rerender } = render(
      <TaskRow task={task("Buy milk")} onToggle={vi.fn()} />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Buy milk" }).getAttribute("aria-checked"),
    ).toBe("false");

    rerender(<TaskRow task={task("Buy milk", { completed })} onToggle={vi.fn()} />);

    expect(
      screen.getByRole("checkbox", { name: "Buy milk" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("draws no meta line under a name that has nothing to show", () => {
    // ADR 0012: the text has equal space above and below. An empty meta
    // line once added 2 px under every single-line row.
    render(<TaskRow task={task("Buy milk")} />);

    const block = screen.getByText("Buy milk").parentElement!;
    expect(block.children).toHaveLength(1);
  });

  it("draws the meta line under the name when the task repeats", () => {
    render(<TaskRow task={task("Buy milk", { recurrence: "RRULE:FREQ=DAILY" })} />);

    const block = screen.getByText("Buy milk").parentElement!;
    expect(block.children).toHaveLength(2);
    expect(block.textContent).toContain("repeats");
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
