import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { ListReorder } from "../lib/list-reorder";
import { TaskCardRow, type TaskCardRowProps } from "./task-card-row";

const spy = vi.hoisted(() => ({ renders: 0 }));

// The row's actions menu reads the safe area, which node cannot load.
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("@/components/task-row", async () => {
  const React = await import("react");
  const Row = React.memo(function Row() {
    spy.renders += 1;
    return null;
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
  onMove: none,
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
});
