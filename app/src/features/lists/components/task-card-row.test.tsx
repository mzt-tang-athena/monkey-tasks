import * as React from "react";
import { Animated } from "react-native";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { TaskCardRow, type TaskCardRowProps } from "./task-card-row";

const spy = vi.hoisted(() => ({ renders: 0 }));

vi.mock("@/components/task-row", () => ({
  TaskRow: () => {
    spy.renders += 1;
    return null;
  },
}));

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

const shift = new Animated.Value(0);
const none = () => undefined;
const props: TaskCardRowProps = {
  task: apple,
  section: "No date",
  position: "middle",
  completed: false,
  canDrag: true,
  lifted: false,
  onToggle: none,
  onOpen: none,
  onHold: none,
  onPickup: none,
  onMove: none,
  onEnd: none,
  registerRow: none,
  shiftOf: () => shift,
};

describe("TaskCardRow", () => {
  it("does not render again for the same values", () => {
    // A slot crossing hands every row a fresh render pass. A row whose
    // corners and divider stay as they are must not draw again.
    const { rerender } = render(<TaskCardRow {...props} />);
    const before = spy.renders;

    rerender(<TaskCardRow {...props} />);

    expect(spy.renders).toBe(before);
  });

  it("renders again when its slot changes its corners", () => {
    const { rerender } = render(<TaskCardRow {...props} />);
    const before = spy.renders;

    rerender(<TaskCardRow {...props} position="first" />);

    expect(spy.renders).toBeGreaterThan(before);
  });
});
