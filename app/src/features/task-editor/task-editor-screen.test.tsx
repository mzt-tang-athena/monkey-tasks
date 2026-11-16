import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import TaskEditorScreen from "./task-editor-screen";

// The route reads the store for its id. A task has no screen of its
// own any more: the editor is a sheet over the list.

const state = vi.hoisted(() => ({ tasks: [] as TaskItem[] }));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({
  router: { back: () => undefined },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "content://vault/Notes/Garden.md" }),
}));

vi.mock("@/stores/tasks/task-state", () => ({
  useTaskList: () => state.tasks,
}));

const NOTE_ID = "content://vault/Notes/Garden.md";

function note(text: string, data: TaskItem["data"]): TaskItem {
  return {
    id: NOTE_ID,
    uri: NOTE_ID,
    fileName: "Garden.md",
    name: "Garden",
    text,
    data,
    body: "\nWater the beds.\n",
  };
}

function deed(): TaskItem {
  return note(
    '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\ncreated: 2026-10-20\n---\n\nWater the beds.\n',
    // The task schema rejects a deed, so the loader leaves data null.
    null,
  );
}

beforeEach(() => {
  state.tasks = [];
});

describe("TaskEditorScreen", () => {
  it("opens a deed note read-only with its frontmatter and body", () => {
    state.tasks = [deed()];
    render(<TaskEditorScreen />);

    expect(screen.getByText("Garden")).toBeTruthy();
    expect(screen.getByText("Water the beds.")).toBeTruthy();
    expect(screen.getByText("kind")).toBeTruthy();
    expect(screen.getByText("[[deeds]]")).toBeTruthy();
    expect(screen.getByText("status")).toBeTruthy();
    expect(screen.getByText("[[active]]")).toBeTruthy();
    expect(screen.getByText("2026-10-20")).toBeTruthy();
    expect(screen.getByText(/not a task/)).toBeTruthy();

    // No editor: no task fields to type into, and no Save.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "save task" })).toBeNull();
    expect(screen.getByRole("button", { name: "close note" })).toBeTruthy();
  });

  it("stays read-only when the parsed data is not a task", () => {
    state.tasks = [
      note(deed().text, {
        kind: "[[deeds]]",
        status: "[[active]]",
        created: "2026-10-20",
      } as unknown as TaskItem["data"]),
    ];
    render(<TaskEditorScreen />);

    expect(screen.getByText("Water the beds.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "save task" })).toBeNull();
  });

  it("sends a task to the editor sheet rather than a screen of its own", () => {
    state.tasks = [
      note(
        '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nOld body.\n',
        { kind: "[[tasks]]", created: "2026-10-20", "alert weight": "harsh" },
      ),
    ];
    render(<TaskEditorScreen />);

    expect(screen.getByText(/opens in the editor over its list/)).toBeTruthy();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("says when the note is gone", () => {
    render(<TaskEditorScreen />);

    expect(screen.getByText(/no longer here/)).toBeTruthy();
  });
});
