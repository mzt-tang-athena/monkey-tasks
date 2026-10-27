import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/features/tasks/query";
import TaskEditorScreen from "./TaskEditorScreen";

// The route and the store are the screen's two inputs: a task id
// selects the row, and the list holds it.

const state = vi.hoisted(() => ({
  tasks: [] as TaskItem[],
  status: "ready" as "loading" | "ready" | "error",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({
  router: { back: () => undefined },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "content://vault/Notes/Garden.md" }),
}));

vi.mock("@/store/task-state", () => ({
  useTaskList: () => state.tasks,
  useStoreMeta: () => ({ status: state.status }),
}));

vi.mock("@/store/task-actions", () => ({
  useTaskActions: () => ({ edit: async () => undefined }),
}));

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

function mount(item: TaskItem) {
  state.tasks = [item];
  render(<TaskEditorScreen />);
}

beforeEach(() => {
  state.tasks = [];
  state.status = "ready";
});

describe("TaskEditorScreen", () => {
  it("opens a deed note read-only with its frontmatter and body", () => {
    mount(deed());

    // The note name, the body below the fences, and every key with
    // the value the file carries.
    expect(screen.getByText("Garden")).toBeTruthy();
    expect(screen.getByText("Water the beds.")).toBeTruthy();
    expect(screen.getByText("kind")).toBeTruthy();
    expect(screen.getByText("[[deeds]]")).toBeTruthy();
    expect(screen.getByText("status")).toBeTruthy();
    expect(screen.getByText("[[active]]")).toBeTruthy();
    expect(screen.getByText("created")).toBeTruthy();
    expect(screen.getByText("2026-10-20")).toBeTruthy();
    expect(screen.getByText(/not a task/)).toBeTruthy();

    // No editor: no Save, and no task fields to type into.
    expect(screen.queryByRole("button", { name: "save task" })).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "cancel editing" })).toBeTruthy();
  });

  it("stays read-only when the parsed data is not a task", () => {
    mount({
      ...deed(),
      data: {
        kind: "[[deeds]]",
        status: "[[active]]",
        created: "2026-10-20",
      } as unknown as TaskItem["data"],
    });

    expect(screen.getByText("Water the beds.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "save task" })).toBeNull();
  });

  it("keeps the editor for a task note", () => {
    mount(task());

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Due")).toBeTruthy();
    expect(screen.getByRole("button", { name: "save task" })).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });
});
