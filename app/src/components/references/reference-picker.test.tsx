import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlayHost } from "@/components/ui/overlay-host";
import type { ReferenceNote } from "@/types/reference";
import { ReferencePicker } from "./reference-picker";

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

function note(
  name: string,
  ingredients: string[] = [],
  categories: string[] = [],
  types: string[] = [],
): ReferenceNote {
  return {
    name,
    uri: `memory://vault/References/${name}.md`,
    text: "",
    body: "",
    ingredients,
    categories,
    types,
  };
}

const notes = [
  note("oatmeal", ["oats", "milk"], ["physical"], ["recipes"]),
  note("chinese-steamed-eggs", ["eggs"], ["physical"], ["recipes"]),
  note("Circe", [], ["environmental"], ["books"]),
];

function Picker({ onAttach = vi.fn() }: { onAttach?: (name: string) => void }) {
  return (
    <OverlayHost>
      <ReferencePicker
        open
        onClose={() => undefined}
        notes={notes}
        attached={["oatmeal"]}
        onAttach={onAttach}
      />
    </OverlayHost>
  );
}

describe("the reference picker", () => {
  it("finds a note by an ingredient and names it", () => {
    render(<Picker />);

    fireEvent.change(screen.getByRole("textbox", { name: "Find a reference" }), {
      target: { value: "oats" },
    });

    const row = screen.getByRole("button", {
      name: "oatmeal, physical, recipes",
    });
    expect(row).toBeTruthy();
    expect(screen.queryByText("chinese-steamed-eggs")).toBeNull();
  });

  it("finds a note by its name and marks the one already linked", () => {
    render(<Picker />);

    fireEvent.change(screen.getByRole("textbox", { name: "Find a reference" }), {
      target: { value: "egg" },
    });
    const row = screen.getByRole("button", {
      name: "chinese-steamed-eggs, physical, recipes",
    });

    expect(row.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(row);
    expect(row.getAttribute("aria-pressed")).toBe("false");

    fireEvent.change(screen.getByRole("textbox", { name: "Find a reference" }), {
      target: { value: "oatmeal" },
    });
    expect(
      screen
        .getByRole("button", { name: "oatmeal, physical, recipes" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("attaches the pressed note", () => {
    const onAttach = vi.fn();
    render(<Picker onAttach={onAttach} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Find a reference" }), {
      target: { value: "egg" },
    });
    fireEvent.click(screen.getByRole("button", { name: /chinese-steamed-eggs/ }));

    expect(onAttach).toHaveBeenCalledWith("chinese-steamed-eggs");
  });

  it("opens the whole folder for a finger that does not type", () => {
    render(<Picker />);

    expect(screen.queryByText("oatmeal")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "browse the References folder" }),
    );

    expect(screen.getByRole("button", { name: "oatmeal, physical, recipes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Circe, environmental, books" })).toBeTruthy();
  });

  it("says so when the folder could not be read", () => {
    render(
      <OverlayHost>
        <ReferencePicker
          open
          onClose={() => undefined}
          notes={[]}
          attached={[]}
          onAttach={() => undefined}
          error="The References folder could not be read."
        />
      </OverlayHost>,
    );

    expect(
      screen.getByText("The References folder could not be read."),
    ).toBeTruthy();
  });
});
