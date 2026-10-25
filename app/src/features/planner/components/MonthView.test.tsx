import * as React from "react";
import { act, create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "../../tasks/query";

// The grid renders React Native views, and this suite runs on node
// without the native runtime, so the host components are stand-ins
// that keep their props. StyleSheet.create hands the sheet back
// untouched, which lets the test recognise the dot by its style
// object rather than by a generated id.
//
// vi.mock factories run before this module's static imports are
// initialized, so React cannot be a top-level binding here; the
// factory reaches it through a dynamic import because hoisting leaves
// no other way in.
vi.mock("react-native", async () => {
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
  return {
    Easing: { bezier: () => (value: number) => value },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Platform: { OS, select: (spec: Record<string, unknown>) => spec[OS] },
    Pressable: host("Pressable"),
    StyleSheet: {
      create: <T,>(sheet: T) => sheet,
      hairlineWidth: 1,
    },
    Text: host("Text"),
    View: host("View"),
  };
});

import { DropZoneMap } from "../../../lib/dropzone";
import { MonthView } from "./MonthView";
import { styles } from "./plannerStyles";

function task(name: string, data: TaskFrontmatter): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data,
  };
}

/** The day cells carrying a dot, in grid order. */
function dottedCells(renderer: ReactTestRenderer): string[] {
  const cells = renderer.root.findAll(
    (node) =>
      (node.type as unknown) === "Pressable" &&
      typeof node.props.accessibilityLabel === "string",
  );
  return cells
    .filter(
      (cell) =>
        cell.findAll((node) => node.props.style === styles.monthDot).length > 0,
    )
    .map((cell) => cell.props.accessibilityLabel as string);
}

async function mount(tasks: TaskItem[]): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(
      <MonthView
        viewMonth={new Date(2026, 9, 1)}
        today={new Date(2026, 9, 1)}
        tasks={tasks}
        picked={null}
        onPick={() => undefined}
        onShiftMonth={() => undefined}
        dropZones={new DropZoneMap()}
        dragActive={false}
        hoveredDay={null}
      />,
    );
  });
  return renderer as unknown as ReactTestRenderer;
}

describe("MonthView grid", () => {
  it("buckets one recurring task onto several days", async () => {
    // October 2026 starts on a Thursday, so the grid is the whole
    // month: a daily rule from the 21st dots the 21st through the 31st.
    const renderer = await mount([
      task("standup", {
        kind: "[[tasks]]",
        created: "2026-10-01",
        due: "2026-10-21",
        recurrence: "FREQ=DAILY",
      }),
    ]);

    expect(dottedCells(renderer)).toEqual([
      "Wednesday 21",
      "Thursday 22",
      "Friday 23",
      "Saturday 24",
      "Sunday 25",
      "Monday 26",
      "Tuesday 27",
      "Wednesday 28",
      "Thursday 29",
      "Friday 30",
      "Saturday 31",
    ]);
  });

  it("keeps a non-recurring task on its own day", async () => {
    const renderer = await mount([
      task("renew passport", {
        kind: "[[tasks]]",
        created: "2026-10-01",
        due: "2026-10-05",
      }),
    ]);

    expect(dottedCells(renderer)).toEqual(["Monday 5"]);
  });

  it("never dots a done recurring task", async () => {
    const renderer = await mount([
      task("standup", {
        kind: "[[tasks]]",
        created: "2026-10-01",
        due: "2026-10-21",
        recurrence: "FREQ=DAILY",
        completed: "2026-10-21",
      }),
    ]);

    expect(dottedCells(renderer)).toEqual([]);
  });
});
