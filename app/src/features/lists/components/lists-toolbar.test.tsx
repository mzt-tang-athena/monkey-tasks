import "@/testing/reduced-motion";
import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlayHost } from "@/components/ui/overlay-host";
import { placeBox } from "@/testing/layout";
import type { TaskItem } from "@/types/task";
import { ListsToolbar } from "./lists-toolbar";

// The sheet rides the keyboard's shared values. The test has no keyboard.
vi.mock("react-native-keyboard-controller", async () => {
  const { useSharedValue } = await import("react-native-reanimated");
  return {
    useReanimatedKeyboardAnimation: () => ({
      height: useSharedValue(0),
      progress: useSharedValue(0),
    }),
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({ router: { push: () => undefined } }));

function completed(name: string, list?: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      completed: "2026-10-26",
      ...(list == null ? {} : { list: `[[${list}]]` }),
    },
    body: "",
  };
}

function renderToolbar(completedRows: TaskItem[]) {
  const onClear = vi.fn();
  render(
    <OverlayHost>
      <ListsToolbar
        tabs={["Main", "Errands"]}
        tab="Main"
        onSelectTab={() => undefined}
        sortMode="due"
        onSortMode={() => undefined}
        completed={completedRows}
        onClearCompleted={onClear}
      />
    </OverlayHost>,
  );
  return onClear;
}

async function openListMenu() {
  placeBox(screen.getByTestId("list-menu-anchor"), {
    x: 300,
    y: 40,
    width: 44,
    height: 44,
  });
  fireEvent.click(screen.getByRole("button", { name: "list menu" }));
  return screen.findByRole("menu", { name: "List menu" });
}

/** The sheet's exit plays on the clock; run it out. */
async function finishMotion() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 320)));
}

const three = [completed("Buy stamps"), completed("Fix bike light"), completed("Water the fern")];

describe("the list overflow menu", () => {
  it("leaves out the clear when the tab has nothing completed", async () => {
    renderToolbar([]);

    await openListMenu();

    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Delete all completed tasks" })).toBeNull();
  });

  it("offers the clear on a tab with completed tasks", async () => {
    renderToolbar(three);

    await openListMenu();

    expect(
      screen.getByRole("menuitem", { name: "Delete all completed tasks" }),
    ).toBeTruthy();
  });

  it("names the count and deletes exactly those notes", async () => {
    const onClear = renderToolbar(three);
    await openListMenu();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete all completed tasks" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Delete completed tasks",
    });
    expect(dialog.textContent).toContain("Delete 3 completed tasks?");
    expect(dialog.textContent).toContain("This removes their notes from the vault.");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClear.mock.calls[0][0]).toEqual(three);
    await finishMotion();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Cancel as the safe default: it holds the focus and changes nothing", async () => {
    const onClear = renderToolbar(three);
    await openListMenu();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete all completed tasks" }),
    );
    await screen.findByRole("dialog", { name: "Delete completed tasks" });
    expect(
      (document.activeElement as HTMLElement | null)?.getAttribute("aria-label"),
    ).toBe("Cancel");

    fireEvent.keyDown(document, { key: "Escape" });
    await finishMotion();

    expect(onClear).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says one task for a count of one", async () => {
    renderToolbar([completed("Buy stamps")]);
    await openListMenu();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete all completed tasks" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Delete completed tasks",
    });
    expect(dialog.textContent).toContain("Delete 1 completed task?");
    expect(dialog.textContent).toContain("This removes its note from the vault.");
  });
});
