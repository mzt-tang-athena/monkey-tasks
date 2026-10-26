import * as React from "react";
import { act, create } from "react-test-renderer";
import type {
  ReactTestRenderer,
  ReactTestRendererNode,
} from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "../../tasks/query";

// The section renders React Native views, and this suite runs on node
// without the native runtime, so the host components are stand-ins
// that keep their props: a tap is the Pressable's onPress, exactly as
// the app wires it. The list stand-in renders its header, rows,
// separator, empty slot, and footer in the order the real FlatList
// gives them, so the test reads the tree a phone would show.

vi.mock("react-native", async () => {
  // vi.mock factories run before this module's static imports are
  // initialized, so React cannot be a top-level binding here. The
  // factory is hoisted, not runtime-selected; there is no other way
  // to reach React from inside it.
  const { createElement } = await import("react");

  type HostProps = { children?: React.ReactNode } & Record<string, unknown>;

  function host(name: string) {
    return function Host({ children, ...props }: HostProps) {
      // The host tag takes the view props verbatim; the cast is only
      // for the arbitrary prop bag a test stand-in forwards.
      return createElement(
        name,
        props as unknown as React.Attributes,
        children,
      );
    };
  }

  type ListProps = {
    data?: readonly unknown[];
    renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
    keyExtractor?: (item: unknown, index: number) => string;
    ListHeaderComponent?: React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    ItemSeparatorComponent?: React.ComponentType;
    style?: unknown;
  };

  function FlatList(props: ListProps) {
    const data = props.data ?? [];
    const children: React.ReactNode[] = [];
    if (props.ListHeaderComponent != null) {
      children.push(
        createElement("View", { key: "header" }, props.ListHeaderComponent),
      );
    }
    if (data.length === 0 && props.ListEmptyComponent != null) {
      children.push(
        createElement("View", { key: "empty" }, props.ListEmptyComponent),
      );
    }
    data.forEach((item, index) => {
      if (index > 0 && props.ItemSeparatorComponent != null) {
        children.push(
          createElement(props.ItemSeparatorComponent, {
            key: `separator-${index}`,
          }),
        );
      }
      const key =
        props.keyExtractor != null ? props.keyExtractor(item, index) : index;
      children.push(
        createElement(
          "View",
          { key },
          props.renderItem != null
            ? props.renderItem({ item, index })
            : null,
        ),
      );
    });
    if (props.ListFooterComponent != null) {
      children.push(
        createElement("View", { key: "footer" }, props.ListFooterComponent),
      );
    }
    return createElement("FlatList", null, children);
  }

  const OS = "android";
  const Platform = {
    OS,
    select: (spec: Record<string, unknown>) => spec[OS],
  };

  const { AccessibilityInfoStandin, AnimatedStandin } = await import(
    "../../../test/rn-standin"
  );

  return {
    AccessibilityInfo: AccessibilityInfoStandin,
    Animated: AnimatedStandin,
    FlatList,
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

vi.mock("react-native-gesture-handler", () => ({
  Gesture: { Pan: () => ({}) },
  GestureDetector: ({ children }: { children?: React.ReactNode }) => children,
}));

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

async function mount(
  tasks: TaskItem[],
  onToggle: (task: TaskItem) => void = () => undefined,
): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(
      <TaskListSection {...baseProps} tasks={tasks} onToggle={onToggle} />,
    );
  });
  return renderer as unknown as ReactTestRenderer;
}

/** The text a consumer reads, in tree order. */
function textOf(
  node: ReactTestRendererNode | ReactTestRendererNode[] | null,
): string {
  if (node == null) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (typeof node === "string") {
    return node;
  }
  return textOf(node.children);
}

describe("TaskListSection", () => {
  it("renders both task names", async () => {
    const tasks = [task("Buy milk"), task("Call the plumber")];
    const renderer = await mount(tasks);

    const text = textOf(renderer.toJSON());
    expect(text).toContain("Buy milk");
    expect(text).toContain("Call the plumber");
    expect(text).not.toContain("Nothing due today");
  });

  it("shows the empty label when the task list is empty", async () => {
    const renderer = await mount([]);

    expect(textOf(renderer.toJSON())).toContain("Nothing due today");
  });

  it("toggles the row whose circle was pressed", async () => {
    const tasks = [task("Buy milk"), task("Call the plumber")];
    const onToggle = vi.fn();
    const renderer = await mount(tasks, onToggle);

    const circles = renderer.root.findAll(
      (node) =>
        (node.type as unknown) === "Pressable" &&
        node.props.accessibilityLabel === "mark done",
    );
    expect(circles).toHaveLength(2);

    act(() => {
      circles[0].props.onPress();
    });
    expect(onToggle).toHaveBeenLastCalledWith(tasks[0]);

    act(() => {
      circles[1].props.onPress();
    });
    expect(onToggle).toHaveBeenLastCalledWith(tasks[1]);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
