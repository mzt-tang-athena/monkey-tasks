import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlayHost } from "@/components/ui/overlay-host";
import type { ReferenceNote } from "@/types/reference";
import { previewText, ReferenceSheet } from "./reference-sheet";

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

const note: ReferenceNote = {
  name: "oatmeal",
  uri: "memory://vault/References/oatmeal.md",
  text: "",
  body: "\nRolled oats with milk.\n",
  ingredients: ["oats"],
  categories: ["physical"],
  types: ["recipes"],
};

function Sheet({
  value,
  loading = false,
  onClose = vi.fn(),
  onDetach = vi.fn(),
}: {
  value: ReferenceNote | null;
  loading?: boolean;
  onClose?: () => void;
  onDetach?: () => void;
}) {
  return (
    <OverlayHost>
      <ReferenceSheet
        open
        name="oatmeal"
        note={value}
        loading={loading}
        onClose={onClose}
        onDetach={onDetach}
      />
    </OverlayHost>
  );
}

describe("previewText", () => {
  it("takes the blank lines off both ends and keeps the text", () => {
    expect(previewText("\nA line.\n\nAnother.\n")).toBe("A line.\n\nAnother.");
    expect(previewText("\n")).toBe("");
  });
});

describe("the reference sheet", () => {
  it("reads the note, its words and its text", () => {
    render(<Sheet value={note} />);

    expect(screen.getByRole("dialog", { name: "Reference" })).toBeTruthy();
    expect(screen.getByText("physical · recipes")).toBeTruthy();
    expect(screen.getByText("Rolled oats with milk.")).toBeTruthy();
  });

  it("closes from Done", () => {
    const onClose = vi.fn();
    render(<Sheet value={note} onClose={onClose} />);

    fireEvent.click(
      screen.getByRole("button", { name: "done with the reference" }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says a missing note is missing and offers to detach it", () => {
    const onDetach = vi.fn();
    render(<Sheet value={null} onDetach={onDetach} />);

    expect(
      screen.getByText(
        "That note is not in the References folder. It may have been renamed or deleted.",
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "detach the missing reference" }),
    );

    expect(onDetach).toHaveBeenCalledTimes(1);
  });

  it("reads as loading until the folder answers", () => {
    render(<Sheet value={null} loading />);

    expect(screen.getByText("Reading the note.")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "detach the missing reference" }),
    ).toBeNull();
  });
});
