import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { ListReorder } from "../lib/list-reorder";
import { TaskCardRow, type TaskCardRowProps } from "./task-card-row";

const spy = vi.hoisted(() => ({ renders: 0 }));

vi.mock("@/components/task-row", async () => {
  const React = await import("react");
  const Row = React.memo(function Row({ grip }: { grip?: React.ReactNode }) {
    React.useEffect(() => {
      spy.renders += 1;
    });
    return <>{grip}</>;
  });
  return { TaskRow: Row };
});

const uri = "content://vault/Tasks/Apple.md";
const apple: TaskItem = {
  id: uri,
  uri,
  fileName: "Apple.md",
  name: "Apple",
  text: "",
  body: "",
  data: { kind: "[[tasks]]", created: "2026-10-20" },
};

const none = () => undefined;
const props: TaskCardRowProps = {
  task: apple,
  section: "No date",
  index: 1,
  count: 3,
  completed: false,
  canDrag: true,
  onToggle: none,
  onOpen: none,
  onTickSettled: none,
};

function Screen(values: TaskCardRowProps) {
  return (
    <ListReorder.Root onReorder={none} renderGhost={() => null}>
      <TaskCardRow {...values} />
    </ListReorder.Root>
  );
}

describe("TaskCardRow", () => {
  it("does not render its task row again for the same values", () => {
    // A slot crossing hands the list row a fresh render pass. The row
    // below the reorder surface must not draw again (J2, 0055).
    const { rerender } = render(<Screen {...props} />);
    const before = spy.renders;

    rerender(<Screen {...props} />);

    expect(spy.renders).toBe(before);
  });

  it("renders again when its task changes", () => {
    const { rerender } = render(<Screen {...props} />);
    const before = spy.renders;

    rerender(
      <Screen {...props} task={{ ...apple, name: "Banana", uri: "b" }} />,
    );

    expect(spy.renders).toBeGreaterThan(before);
  });

  it("keeps the task row through a slot crossing", () => {
    // The reorder's corners and shift live on the item, not here, so a
    // new index must not reach the task row.
    const { rerender } = render(<Screen {...props} />);
    const before = spy.renders;

    rerender(<Screen {...props} index={0} />);

    expect(spy.renders).toBe(before);
  });

  it("hands its grip the task's name and the row's place", () => {
    render(<Screen {...props} />);

    const grip = screen.getByTestId("reorder-grip:Apple");
    expect(grip.getAttribute("role")).toBe("slider");
    expect(grip.getAttribute("aria-label")).toBe("reorder Apple");
    expect(grip.getAttribute("aria-valuemin")).toBe("1");
    expect(grip.getAttribute("aria-valuemax")).toBe("3");
    expect(grip.getAttribute("aria-valuenow")).toBe("2");
  });
});
