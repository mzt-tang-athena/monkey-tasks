import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import { OverlayHost } from "@/components/ui/overlay-host";
import { NoteChangedError } from "@/lib/vault/notes";
import { JournalDock } from "./journal-dock";

// The dock reads the route, the safe area, the keyboard and the journal
// write. The test owns each of them.

const state = vi.hoisted(() => ({
  append: vi.fn<(draft: { block: string; retry: boolean }) => Promise<void>>(),
  focused: true,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({
  router: { navigate: vi.fn(), back: vi.fn() },
  usePathname: () => "/journal",
  useIsFocused: () => state.focused,
}));

vi.mock("react-native-keyboard-controller", async () => {
  const { useSharedValue } = await import("react-native-reanimated");
  return {
    useReanimatedKeyboardAnimation: () => ({
      height: useSharedValue(0),
      progress: useSharedValue(0),
    }),
  };
});

vi.mock("@/stores/journal/mutations/use-append-entry", () => ({
  useAppendEntry: () => state.append,
}));

const onSend = vi.fn();

function Screen({ day = "2026-10-26" }: { day?: string }) {
  return (
    <OverlayHost>
      <BottomBar action={<JournalDock day={day} onSend={onSend} />} />
    </OverlayHost>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function finishMotion() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 320)));
}

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: "add entry" }));
}

function type(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/What/), {
    target: { value: text },
  });
}

function send() {
  fireEvent.click(screen.getByRole("button", { name: "send entry" }));
}

describe("JournalDock", () => {
  beforeEach(() => {
    state.append.mockReset();
    state.append.mockResolvedValue(undefined);
    state.focused = true;
    onSend.mockClear();
  });

  it("opens a named entry sheet from the Add button", () => {
    render(<Screen />);
    expect(screen.queryByRole("dialog")).toBeNull();

    openSheet();

    expect(screen.getByRole("dialog", { name: "Write an entry" })).toBeTruthy();
    expect(screen.getByPlaceholderText("What happened?")).toBeTruthy();
  });

  it("keeps the Food chip's choice across a close and a reopen", async () => {
    render(<Screen />);
    openSheet();

    fireEvent.click(screen.getByRole("button", { name: "food entry: off" }));
    expect(screen.getByRole("button", { name: "food entry: on" })).toBeTruthy();
    expect(screen.getByPlaceholderText("What did you eat?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "close entry" }));
    await finishMotion();
    openSheet();

    expect(screen.getByRole("button", { name: "food entry: on" })).toBeTruthy();
  });

  it("sends one block and closes the sheet", async () => {
    render(<Screen />);
    openSheet();
    type("walked to the shop\nbought bread");
    send();
    await flush();

    expect(onSend).toHaveBeenCalled();
    expect(state.append).toHaveBeenCalledTimes(1);
    const draft = state.append.mock.calls[0][0];
    expect(draft.retry).toBe(false);
    expect(draft.block).toMatch(/^\d{2}:\d{2}\n- walked to the shop\n- bought bread$/);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks a food send with the prefix and the tag", async () => {
    render(<Screen />);
    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "food entry: off" }));
    type("toast");
    send();
    await flush();

    expect(state.append.mock.calls[0][0].block).toMatch(
      /^\d{2}:\d{2}\n- Ate: toast #food$/,
    );
  });

  it("keeps the draft and offers a retry after a failed write", async () => {
    state.append.mockRejectedValueOnce(new Error("disk full"));
    render(<Screen />);
    openSheet();
    type("one line");
    send();
    await flush();

    expect(screen.getByText(/Couldn't save the entry\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "retry entry" }));
    await flush();

    expect(state.append).toHaveBeenCalledTimes(2);
    const first = state.append.mock.calls[0][0];
    const second = state.append.mock.calls[1][0];
    expect(second.block).toBe(first.block);
    expect(second.retry).toBe(true);
  });

  it("explains a note changed by another app", async () => {
    state.append.mockRejectedValueOnce(new NoteChangedError("memory://vault/x"));
    render(<Screen />);
    openSheet();
    type("one line");
    send();
    await flush();

    expect(
      screen.getByText(/Your note changed in another app\./),
    ).toBeTruthy();
  });

  it("keeps the draft after a failure and reopens with it", async () => {
    state.append.mockRejectedValueOnce(new Error("disk full"));
    render(<Screen />);
    openSheet();
    type("one line");
    send();
    await flush();
    openSheet();

    expect(screen.getByDisplayValue("one line")).toBeTruthy();
  });
});
