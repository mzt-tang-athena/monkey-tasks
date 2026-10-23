import * as React from "react";
import { act, create } from "react-test-renderer";
import type {
  ReactTestRenderer,
  ReactTestRendererNode,
} from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "../tasks/query";

// The screen renders React Native views, and this suite runs on node
// without the native runtime, so the host components are stand-ins
// that keep their props. The route and the store are the screen's two
// inputs: a task id selects the row, and the list holds it.

const state = vi.hoisted(() => ({
  tasks: [] as TaskItem[],
  status: "ready" as "loading" | "ready" | "error",
}));

vi.mock("react-native", async () => {
  // vi.mock factories run before this module's static imports are
  // initialized, so React cannot be a top-level binding here.
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

  return {
    Alert: { alert: () => undefined },
    Platform,
    Pressable: host("Pressable"),
    ScrollView: host("ScrollView"),
    StyleSheet: {
      create: <T,>(sheet: T) => sheet,
      hairlineWidth: 1,
    },
    Text: host("Text"),
    TextInput: host("TextInput"),
    View: host("View"),
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({
  router: { back: () => undefined },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "content://vault/Notes/Garden.md" }),
}));

vi.mock("../../store/task-state", () => ({
  useTaskList: () => state.tasks,
  useStoreMeta: () => ({ status: state.status }),
}));

vi.mock("../../store/task-actions", () => ({
  useTaskActions: () => ({ edit: async () => undefined }),
}));

import TaskEditorScreen from "./TaskEditorScreen";

const NOTE_ID = "content://vault/Notes/Garden.md";

function deed(): TaskItem {
  return {
    id: NOTE_ID,
    uri: NOTE_ID,
    fileName: "Garden.md",
    name: "Garden",
    text: '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\ncreated: 2026-10-20\n---\n\nWater the beds.\n',
    // The task schema rejects a deed, so the loader leaves data null.
    data: null,
    body: "\nWater the beds.\n",
  };
}

function task(): TaskItem {
  return {
    id: NOTE_ID,
    uri: NOTE_ID,
    fileName: "Call.md",
    name: "Call",
    text: '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nOld body.\n',
    data: { kind: "[[tasks]]", created: "2026-10-20" },
    body: "\nOld body.\n",
  };
}

async function mount(item: TaskItem): Promise<ReactTestRenderer> {
  state.tasks = [item];
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<TaskEditorScreen />);
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

function withLabel(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    (node) =>
      (node.type as unknown) === "Pressable" &&
      node.props.accessibilityLabel === label,
  );
}

beforeEach(() => {
  state.tasks = [];
  state.status = "ready";
});

describe("TaskEditorScreen", () => {
  it("opens a deed note read-only with its frontmatter and body", async () => {
    const renderer = await mount(deed());
    const text = textOf(renderer.toJSON());

    // The note name, the body below the fences, and every key with
    // the value the file carries.
    expect(text).toContain("Garden");
    expect(text).toContain("Water the beds.");
    expect(text).toContain("kind");
    expect(text).toContain("[[deeds]]");
    expect(text).toContain("status");
    expect(text).toContain("[[active]]");
    expect(text).toContain("created");
    expect(text).toContain("2026-10-20");
    expect(text).toContain("not a task");

    // No editor: no Save, and no task fields to type into.
    expect(withLabel(renderer, "save task")).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => (node.type as unknown) === "TextInput"),
    ).toHaveLength(0);
    expect(withLabel(renderer, "cancel editing")).toHaveLength(1);
  });

  it("stays read-only when the parsed data is not a task", async () => {
    const item: TaskItem = {
      ...deed(),
      data: {
        kind: "[[deeds]]",
        status: "[[active]]",
        created: "2026-10-20",
      } as unknown as TaskItem["data"],
    };

    const renderer = await mount(item);

    expect(textOf(renderer.toJSON())).toContain("Water the beds.");
    expect(withLabel(renderer, "save task")).toHaveLength(0);
  });

  it("keeps the editor for a task note", async () => {
    const renderer = await mount(task());
    const text = textOf(renderer.toJSON());

    expect(text).toContain("Name");
    expect(text).toContain("Due");
    expect(text).toContain("Save");
    expect(withLabel(renderer, "save task")).toHaveLength(1);
  });
});
