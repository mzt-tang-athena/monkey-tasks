import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackHandler, Platform, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Pressable } from "./pressable";
import { OverlayHost } from "./overlay-host";
import { CommandPane, type CommandRow } from "./command-pane";

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const rows: CommandRow[] = [
  { id: "capture", label: "Add task", onPress: () => {} },
  { id: "planner", label: "Go to Planner", hint: "Calendar", onPress: () => {} },
  { id: "settings", label: "Settings", keywords: ["preferences"], onPress: () => {} },
];

function Harness({ commands = rows }: { commands?: CommandRow[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <GestureHandlerRootView>
      <OverlayHost>
        <Text>screen content</Text>
        <Pressable
          role="button"
          accessibilityLabel="open"
          onPress={() => setOpen(true)}
        >
          <Text>open</Text>
        </Pressable>
        <CommandPane
          open={open}
          onClose={() => setOpen(false)}
          label="Commands"
          placeholder="Search commands"
          commands={commands}
          emptyLabel="No commands"
        />
      </OverlayHost>
    </GestureHandlerRootView>
  );
}

/** The pane's spring exit; let it run out. */
async function finishMotion() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 700)));
}

/** An ancestor carries `inert`. */
function inert(element: HTMLElement): boolean {
  let node: HTMLElement | null = element;
  while (node != null) {
    if (node.hasAttribute("inert")) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

describe("CommandPane", () => {
  it("reports a named modal dialog with a search field", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    const dialog = screen.getByRole("dialog", { name: "Commands" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByPlaceholderText("Search commands")).toBeTruthy();
  });

  it("makes the screen inert while it shows", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    expect(inert(screen.getByText("screen content"))).toBe(true);
    expect(inert(screen.getByRole("dialog"))).toBe(false);
  });

  it("filters the rows as the user types", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    fireEvent.change(screen.getByPlaceholderText("Search commands"), {
      target: { value: "plan" },
    });

    expect(screen.queryByTestId("command:capture")).toBeNull();
    expect(screen.getByTestId("command:planner")).toBeTruthy();
  });

  it("matches a keyword that is not on the row", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    fireEvent.change(screen.getByPlaceholderText("Search commands"), {
      target: { value: "preferences" },
    });

    expect(screen.getByTestId("command:settings")).toBeTruthy();
    expect(screen.queryByTestId("command:capture")).toBeNull();
  });

  it("says so when nothing matches", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    fireEvent.change(screen.getByPlaceholderText("Search commands"), {
      target: { value: "journal" },
    });

    expect(screen.getByText("No commands")).toBeTruthy();
  });

  it("runs the chosen row", () => {
    const onPress = vi.fn();
    render(
      <Harness
        commands={[{ id: "capture", label: "Add task", onPress }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    fireEvent.click(screen.getByTestId("command:capture"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("takes focus into the search and back to the opener on close", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "open" });
    opener.focus();

    fireEvent.click(opener);
    const search = screen.getByPlaceholderText("Search commands");
    await waitFor(() => expect(document.activeElement).toBe(search));

    fireEvent.click(screen.getByRole("button", { name: "close commands" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("draws each row at least 44pt high", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    const row = screen.getByTestId("command:capture");
    expect(getComputedStyle(row).minHeight).toBe("44px");
  });

  it("draws at most 12 rows", () => {
    const many = Array.from({ length: 15 }, (_, at) => ({
      id: `c${at}`,
      label: `Command ${at}`,
      onPress: () => {},
    }));
    render(<Harness commands={many} />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    expect(screen.queryAllByTestId(/^command:/)).toHaveLength(12);
  });

  it("closes on Escape and leaves once its exit has played", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    fireEvent.keyDown(document, { key: "Escape" });
    await finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a press outside the panel", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    fireEvent.click(screen.getByRole("button", { name: "dismiss commands" }));
    await finishMotion();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("on Android", () => {
    const os = Platform.OS;
    let back: ((event: never) => boolean | null | undefined) | null = null;

    beforeEach(() => {
      (Platform as { OS: string }).OS = "android";
      vi.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
        back = handler;
        return { remove: () => (back = null) };
      });
    });
    afterEach(() => {
      (Platform as { OS: string }).OS = os;
    });

    it("closes on the back button and takes the press", async () => {
      render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "open" }));

      let handled: boolean | null | undefined;
      act(() => {
        handled = back?.(undefined as never);
      });
      await finishMotion();

      expect(handled).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
