import * as React from "react";
import { act, create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "../features/tasks/query";

// The row renders React Native views, and this suite runs on node
// without the native runtime, so the host components are stand-ins
// that keep their props: a tap is the Pressable's onPress, exactly as
// the app wires it.

vi.mock("react-native", async () => {
  // vi.mock factories run before this module's static imports are
  // initialized, so React cannot be a top-level binding here. A
  // static import cannot work inside a hoisted factory.
  const { createElement } = await import("react");

  type HostProps = { children?: React.ReactNode } & Record<string, unknown>;

  function host(name: string) {
    return function Host({ children, ...props }: HostProps) {
      return createElement(
        name,
        props as unknown as React.Attributes,
        children,
      );
    };
  }

  const OS = "android";
  const Platform = {
    OS,
    select: (spec: Record<string, unknown>) => spec[OS],
  };

  const { AccessibilityInfoStandin, AnimatedStandin, EasingStandin } = await import(
    "../test/rn-standin"
  );

  return {
    AccessibilityInfo: AccessibilityInfoStandin,
    Animated: AnimatedStandin,
    Easing: EasingStandin,
    Platform,
    Pressable: host("Pressable"),
    StyleSheet: {
      create: <T,>(sheet: T) => sheet,
      hairlineWidth: 1,
    },
    Text: host("Text"),
    View: host("View"),
  };
});

import { TaskRow } from "./TaskRow";

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

async function mount(
  item: TaskItem,
  handlers: {
    onToggle?: (task: TaskItem) => void;
    onOpen?: (task: TaskItem) => void;
  },
): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<TaskRow task={item} {...handlers} />);
  });
  return renderer as unknown as ReactTestRenderer;
}

function pressable(renderer: ReactTestRenderer, label: string) {
  return renderer.root.find(
    (node) =>
      (node.type as unknown) === "Pressable" &&
      node.props.accessibilityLabel === label,
  );
}

describe("TaskRow", () => {
  it("opens the task from the body and still toggles from the circle", async () => {
    const item = task("Buy milk");
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    const renderer = await mount(item, { onOpen, onToggle });

    act(() => {
      pressable(renderer, "open task").props.onPress();
    });
    expect(onOpen).toHaveBeenCalledWith(item);
    expect(onToggle).not.toHaveBeenCalled();

    act(() => {
      pressable(renderer, "mark done").props.onPress();
    });
    expect(onToggle).toHaveBeenCalledWith(item);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the check before the write lands", async () => {
    // The task's data is untouched here: this is the moment between
    // the tap and the note being written.
    const item = task("Buy milk");
    const renderer = await mount(item, { onToggle: vi.fn() });

    act(() => {
      pressable(renderer, "mark done").props.onPress();
    });

    const circle = pressable(renderer, "mark not done");
    expect(circle.props.accessibilityState).toEqual({ checked: true });
    const glyphs = renderer.root
      .findAll((node) => (node.type as unknown) === "Text")
      .map((node) => node.props.children);
    expect(glyphs).toContain("✓");
  });

  it("lets the data win again once it agrees", async () => {
    const item = task("Buy milk");
    const renderer = await mount(item, { onToggle: vi.fn() });
    const withDone = (done: boolean) => {
      const data = {
        kind: "[[tasks]]" as const,
        created: "2026-10-20",
        ...item.data,
        completed: done ? "2026-10-25T10:00:00" : undefined,
      };
      return <TaskRow task={{ ...item, data }} onToggle={vi.fn()} />;
    };

    act(() => {
      pressable(renderer, "mark done").props.onPress();
    });

    // The write lands: the local tick has nothing left to say.
    await act(async () => {
      renderer.update(withDone(true));
    });
    expect(pressable(renderer, "mark not done")).toBeTruthy();

    // A later change from the vault is shown, not shadowed by a stale
    // local tick.
    await act(async () => {
      renderer.update(withDone(false));
    });
    expect(pressable(renderer, "mark done")).toBeTruthy();
  });
});
