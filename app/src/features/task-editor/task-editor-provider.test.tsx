import "@/testing/reduced-motion";
import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { dayLabel, formatTime } from "@/utils/dates";
import { OverlayHost } from "@/components/ui/overlay-host";
import { NoteChangedError } from "@/lib/vault/notes";
import { useTaskEditor } from "@/hooks/use-task-editor";
import { TaskEditorProvider } from "./task-editor-provider";

// The editor sheet as a user meets it: open it from a row, change a
// property, and read what the store's mutation received.

const store = vi.hoisted(() => ({
  tasks: [] as TaskItem[],
  lists: [] as string[],
  edit: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  toggle: vi.fn(),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("react-native-keyboard-controller", async () => {
  const { useSharedValue } = await import("react-native-reanimated");
  return {
    useReanimatedKeyboardAnimation: () => ({
      height: useSharedValue(0),
      progress: useSharedValue(0),
    }),
    useKeyboardState: () => 0,
  };
});

vi.mock("@/stores/tasks/task-state", () => ({
  useTaskList: () => store.tasks,
  useStoreMeta: () => ({ lists: store.lists, status: "ready" }),
}));

vi.mock("@/stores/references/use-references", () => ({
  useReferenceNotes: () => ({
    notes: [
      {
        name: "oatmeal",
        uri: "memory://vault/References/oatmeal.md",
        text: "---\ningredients:\n  - oats\n---\n\nRolled oats.\n",
        body: "\nRolled oats.\n",
        ingredients: ["oats"],
        categories: ["physical"],
        types: ["recipes"],
      },
    ],
    error: null,
  }),
}));

vi.mock("@/stores/tasks/mutations/use-edit-task", () => ({
  useEditTask: () => store.edit,
}));
vi.mock("@/stores/tasks/mutations/use-delete-task", () => ({
  useDeleteTask: () => store.remove,
}));
vi.mock("@/stores/tasks/mutations/use-restore-task", () => ({
  useRestoreTask: () => store.restore,
}));
vi.mock("@/stores/tasks/mutations/use-toggle-task", () => ({
  useToggleTask: () => store.toggle,
}));

const TEXT = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nOld body.\n';

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "content://vault/Tasks/Call.md",
    uri: "content://vault/Tasks/Call.md",
    fileName: "Call.md",
    name: "Call Mum",
    text: TEXT,
    data: { kind: "[[tasks]]", created: "2026-10-20", "alert weight": "quiet" },
    body: "\nOld body.\n",
    ...overrides,
  };
}

function Open() {
  const editor = useTaskEditor();
  return (
    <button onClick={() => editor.open("content://vault/Tasks/Call.md")}>
      open task
    </button>
  );
}

function mount() {
  render(
    <OverlayHost>
      <TaskEditorProvider>
        <Open />
      </TaskEditorProvider>
    </OverlayHost>,
  );
}

function openTask() {
  fireEvent.click(screen.getByRole("button", { name: "open task" }));
}

/** A stored day as the tiles say it, from today. */
function words(stored: string): string {
  const [storedYear, month, day] = stored.slice(0, 10).split("-").map(Number);
  const at = new Date(storedYear, month - 1, day);
  const clock = stored.includes("T") ? stored.slice(11) : null;
  const time =
    clock == null
      ? ""
      : ` ${formatTime(
          new Date(2000, 0, 1, Number(clock.slice(0, 2)), Number(clock.slice(3))),
        )}`;
  const year =
    at.getFullYear() === new Date().getFullYear() ? "" : ` ${at.getFullYear()}`;
  return `${dayLabel(at, new Date())}${year}${time}`;
}

/** The draft a write received. */
function written(at = 0) {
  return store.edit.mock.calls[at]?.[1];
}

beforeEach(() => {
  store.tasks = [task()];
  store.lists = ["Focus", "Work"];
  store.edit.mockReset().mockImplementation(async (row: TaskItem, edit) => ({
    ...row,
    text: `${row.text}\n`,
    data: { ...row.data, due: edit.due ?? undefined },
  }));
  store.remove.mockReset().mockResolvedValue({ row: task(), text: TEXT });
  store.restore.mockReset().mockResolvedValue(task());
  store.toggle.mockReset().mockResolvedValue(undefined);
});

describe("the task editor sheet", () => {
  it("shows the list, the title and a chip for every property with no value", () => {
    mount();
    openTask();

    expect(screen.getByRole("dialog", { name: "Task" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^change list/ })).toBeTruthy();
    expect(screen.getByText("Main")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Task name" })).toHaveProperty(
      "value",
      "Call Mum",
    );
    for (const name of [
      "add due date",
      "add repeat",
      "add reminder",
      "link a reference",
      "edit note",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    // No Save: every change is already written.
    expect(screen.queryByRole("button", { name: "save task" })).toBeNull();
  });

  it("writes a due date picked from the quick days", async () => {
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "add due date" }));
    expect(screen.getByRole("dialog", { name: "Due" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(1));
    const [, edit, expected] = store.edit.mock.calls[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    expect(edit.due).toBe(iso);
    expect(expected).toBe(TEXT);
  });

  it("shows a set value as a tile and clears it from the tile", async () => {
    store.tasks = [
      task({
        text: `${TEXT}`,
        data: {
          kind: "[[tasks]]",
          created: "2026-10-20",
          "alert weight": "harsh",
          due: "2026-10-27",
          recurrence: "FREQ=WEEKLY",
          reminders: ["2026-10-28T09:00"],
        },
      }),
    ];
    mount();
    openTask();
    expect(screen.getByRole("button", { name: "change due date" })).toBeTruthy();
    expect(screen.getByText(words("2026-10-27"))).toBeTruthy();
    expect(screen.getByRole("button", { name: "change repeat" })).toBeTruthy();
    expect(screen.getByText("Every Tuesday")).toBeTruthy();
    // The reminder reads in plain words, with no rule text anywhere.
    expect(screen.getByText(words("2026-10-28T09:00"))).toBeTruthy();
    // A reminder chip stays in the strip even when one is set.
    expect(screen.getByRole("button", { name: "add reminder" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "add due date" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "clear due date" }));

    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(1));
    expect(written().due).toBeNull();
  });

  it("offers one Alarm switch, off for a normal reminder, and writes harsh", async () => {
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "add reminder" }));
    const alarm = () => screen.getByRole("switch", { name: "alarm" });
    expect(alarm().getAttribute("aria-checked")).toBe("false");
    expect(
      screen.getByText("Sounds an alarm and breaks Do Not Disturb."),
    ).toBeTruthy();

    fireEvent.click(alarm());

    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(1));
    expect(written().alertWeight).toBe("harsh");
    expect(alarm().getAttribute("aria-checked")).toBe("true");
  });

  it("opens an alarm task with the switch on, and says so on its Alerts tile", () => {
    store.tasks = [
      task({
        data: {
          kind: "[[tasks]]",
          created: "2026-10-20",
          "alert weight": "harsh",
          reminders: ["2026-10-28T09:00"],
        },
      }),
    ];
    mount();
    openTask();

    const tile = screen.getByRole("button", { name: "change alerts" });
    expect(tile.textContent).toContain("Alarm");
    fireEvent.click(tile);
    expect(
      screen.getByRole("switch", { name: "alarm" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(store.edit).not.toHaveBeenCalled();
  });

  it("keeps the value on screen and reports a failed write", async () => {
    store.edit.mockRejectedValueOnce(new Error("disk full"));
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "add due date" }));
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

    expect(await screen.findByText("Not saved.", undefined, { timeout: 4000 })).toBeTruthy();
    expect(
      screen.getByText("The file did not change. Retry writes it again."),
    ).toBeTruthy();
    // The raw error names a file call, not a next step.
    expect(screen.queryByText(/disk full/)).toBeNull();
    // The new value stays on screen.
    expect(screen.getByRole("button", { name: "change due date" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "retry save" })).toBeTruthy();
  }, 15000);

  it("says so when the note changed on disk before the write", async () => {
    store.edit.mockRejectedValueOnce(new NoteChangedError("content://vault/Tasks/Call.md"));
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "add due date" }));
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

    expect(
      await screen.findByText(
        "The note changed on disk. Retry writes this change onto it.",
        undefined,
        { timeout: 4000 },
      ),
    ).toBeTruthy();
  }, 15000);

  it("sends the same draft again on Retry, against the latest text", async () => {
    store.edit.mockRejectedValueOnce(new Error("disk full"));
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "add due date" }));
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    const retry = await screen.findByRole(
      "button",
      { name: "retry save" },
      { timeout: 4000 },
    );

    fireEvent.click(retry);
    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(2), {
      timeout: 4000,
    });
    expect(written(1)).toEqual(written(0));
    expect(store.edit.mock.calls[1][2]).toBe(TEXT);
  }, 15000);

  it("writes a note from the note editor", async () => {
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "edit note" }));
    const field = screen.getByRole("textbox", { name: "Note" });
    fireEvent.change(field, { target: { value: "Buy stamps\nand milk" } });
    fireEvent.click(screen.getByRole("button", { name: "done with the note" }));

    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(1));
    expect(written().body).toBe("\nBuy stamps\nand milk\n");
    expect(screen.queryByRole("dialog", { name: "Note" })).toBeNull();
  });

  it("deletes from the menu and puts the task back on Undo", async () => {
    mount();
    openTask();
    // The menu opens from a measured anchor. jsdom reports none, so the
    // anchor reports where the button sits.
    const anchor = screen.getByTestId("task-menu-anchor") as unknown as {
      measureInWindow: (
        callback: (x: number, y: number, width: number, height: number) => void,
      ) => void;
    };
    anchor.measureInWindow = (callback) => callback(0, 400, 44, 44);

    fireEvent.click(screen.getByRole("button", { name: "task menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    await waitFor(() => expect(store.remove).toHaveBeenCalledTimes(1));
    expect(store.remove.mock.calls[0][0].id).toBe(task().id);
    expect(await screen.findByText("Task deleted")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "undo delete" }));
    await waitFor(() => expect(store.restore).toHaveBeenCalledTimes(1));
    expect(store.restore.mock.calls[0][0]).toEqual({ row: task(), text: TEXT });
  });

  it("ticks the task through the toggle and closes the sheet", async () => {
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "mark done" }));

    await waitFor(() => expect(store.toggle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("writes a new title on blur, not on every keystroke", async () => {
    mount();
    openTask();
    const field = screen.getByRole("textbox", { name: "Task name" });

    fireEvent.change(field, { target: { value: "Call Mum about Sunday" } });
    expect(store.edit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.blur(field);
    });
    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(1));
    expect(written().name).toBe("Call Mum about Sunday");
  });

  it("writes the title as typed when the sheet closes at once", async () => {
    mount();
    openTask();
    const field = screen.getByRole("textbox", { name: "Task name" });

    // Typing and pressing Close, with no other press between, still
    // writes the last keystroke.
    fireEvent.change(field, { target: { value: "Call Mum about Sunday" } });
    fireEvent.click(screen.getByRole("button", { name: "close the task" }));

    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(1));
    expect(written().name).toBe("Call Mum about Sunday");
  });

  it("reverts an empty title instead of writing it", async () => {
    mount();
    openTask();
    const field = screen.getByRole("textbox", { name: "Task name" });

    fireEvent.change(field, { target: { value: "  " } });
    await act(async () => {
      fireEvent.blur(field);
    });

    expect(store.edit).not.toHaveBeenCalled();
    expect(field).toHaveProperty("value", "Call Mum");
  });

  it("attaches a reference, previews it, then detaches it from its row", async () => {
    mount();
    openTask();

    fireEvent.click(screen.getByRole("button", { name: "link a reference" }));
    expect(screen.getByRole("dialog", { name: "Reference" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Find a reference" }), {
      target: { value: "oats" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "oatmeal, physical, recipes" }),
    );

    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(1));
    expect(written().body).toBe(
      "\nOld body.\n\n## Reference\n\n[[oatmeal]]\n",
    );

    // The link is on the tile now, and a press on it reads the note.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(
      screen.getByRole("button", { name: "open reference oatmeal" }),
    );
    expect(screen.getByRole("dialog", { name: "Reference" })).toBeTruthy();
    expect(screen.getByText("Rolled oats.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "done with the reference" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "remove reference oatmeal" }),
    );

    await waitFor(() => expect(store.edit).toHaveBeenCalledTimes(2));
    expect(written(1).body).toBe("\nOld body.\n");
    expect(screen.queryByRole("button", { name: "open reference oatmeal" })).toBeNull();
  });
});
