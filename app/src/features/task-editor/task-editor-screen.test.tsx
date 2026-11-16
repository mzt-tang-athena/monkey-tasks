import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskEditorContext } from "@/hooks/use-task-editor";
import type { TaskItem } from "@/types/task";
import TaskEditorScreen from "./task-editor-screen";

// The route reads the store for its id. A task has no screen of its
// own: the route hands it to the editor sheet and steps back.

const state = vi.hoisted(() => ({
  tasks: [] as TaskItem[],
  status: "ready" as "loading" | "ready" | "error",
  canGoBack: true,
  nav: [] as string[],
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({
  router: {
    canGoBack: () => state.canGoBack,
    back: () => state.nav.push("back"),
    replace: (href: string) => state.nav.push(`replace ${href}`),
  },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "content://vault/Notes/Garden.md" }),
}));

vi.mock("@/stores/tasks/task-state", () => ({
  useTaskList: () => state.tasks,
  useStoreMeta: () => ({ status: state.status }),
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

function taskNote(): TaskItem {
  return note(
    '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nOld body.\n',
    { kind: "[[tasks]]", created: "2026-10-20", "alert weight": "harsh" },
  );
}

/** Render under an editor that records each task it opens. */
function renderWithEditor() {
  const opened: string[] = [];
  const view = () => (
    <TaskEditorContext.Provider
      value={{ open: (taskId) => opened.push(taskId), showing: false }}
    >
      <TaskEditorScreen />
    </TaskEditorContext.Provider>
  );
  const { rerender } = render(view());
  return { opened, rerender: () => rerender(view()) };
}

beforeEach(() => {
  state.tasks = [];
  state.status = "ready";
  state.canGoBack = true;
  state.nav = [];
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

  it("opens a task in the editor sheet and steps back to the screen below", () => {
    state.tasks = [taskNote()];
    const { opened } = renderWithEditor();

    expect(opened).toEqual([NOTE_ID]);
    expect(state.nav).toEqual(["back"]);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("goes home under the sheet when the alert started the app", () => {
    state.canGoBack = false;
    state.tasks = [taskNote()];
    const { opened } = renderWithEditor();

    expect(opened).toEqual([NOTE_ID]);
    expect(state.nav).toEqual(["replace /"]);
  });

  it("waits for the store, then opens the task", () => {
    state.status = "loading";
    const { opened, rerender } = renderWithEditor();
    expect(screen.getByText("Loading note...")).toBeTruthy();
    expect(opened).toEqual([]);

    state.status = "ready";
    state.tasks = [taskNote()];
    rerender();
    expect(opened).toEqual([NOTE_ID]);
  });

  it("says when the note is gone", () => {
    render(<TaskEditorScreen />);

    expect(screen.getByText(/no longer here/)).toBeTruthy();
  });
});
