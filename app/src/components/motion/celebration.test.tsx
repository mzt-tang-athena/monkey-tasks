import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { OverlayHost } from "@/components/ui/overlay-host";
import { TaskRow } from "@/components/task-row";
import { CelebrationProvider } from "./celebration";

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

/** The row under the same providers as the app. */
function Shelf({
  item,
  onToggle,
}: {
  item: TaskItem;
  onToggle: (item: TaskItem) => void;
}) {
  return (
    <OverlayHost>
      <CelebrationProvider>
        <TaskRow task={item} onToggle={onToggle} />
      </CelebrationProvider>
    </OverlayHost>
  );
}

/** Lets the burst's measure call and any state update land. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });

describe("the completion celebration", () => {
  it("plays one burst when the user ticks a task", async () => {
    render(<Shelf item={task("Buy milk")} onToggle={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Buy milk" }));

    expect(await screen.findByTestId("tick-burst")).toBeTruthy();
  });

  it("plays nothing when the user unticks a done task", async () => {
    render(
      <Shelf
        item={task("Buy milk", { completed })}
        onToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Buy milk" }));
    await settle();

    expect(screen.queryByTestId("tick-burst")).toBeNull();
  });

  it("plays nothing when the data turns done without a press", async () => {
    // A sync, a reload or another app writes the same task. The row
    // may play its tick, but no hand ticked it.
    const onToggle = vi.fn();
    const { rerender } = render(
      <Shelf item={task("Buy milk")} onToggle={onToggle} />,
    );

    rerender(
      <Shelf item={task("Buy milk", { completed })} onToggle={onToggle} />,
    );
    await settle();

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.queryByTestId("tick-burst")).toBeNull();
  });
});
