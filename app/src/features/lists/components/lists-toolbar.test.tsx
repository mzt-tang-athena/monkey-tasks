import "@/testing/reduced-motion";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlayHost } from "@/components/ui/overlay-host";
import { setWindowSize } from "@/testing/layout";
import type { SortMode } from "@/lib/settings";
import { ListsToolbar } from "./lists-toolbar";

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));

function Harness({ sortMode }: { sortMode: SortMode }) {
  return (
    <OverlayHost>
      <ListsToolbar
        tabs={["Main", "Errands"]}
        tab="Main"
        onSelectTab={() => undefined}
        sortMode={sortMode}
        onSortMode={() => undefined}
      />
    </OverlayHost>
  );
}

describe("ListsToolbar", () => {
  it("fills the sort glyph for a non-default order and an open menu", () => {
    setWindowSize(390, 800);
    const { rerender } = render(<Harness sortMode="due" />);
    expect(screen.getByTestId("icon:sort")).toBeTruthy();

    rerender(<Harness sortMode="manual" />);
    expect(screen.getByTestId("icon:sort:fill")).toBeTruthy();

    rerender(<Harness sortMode="due" />);
    expect(screen.getByTestId("icon:sort")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "sort list" }));

    expect(screen.getByTestId("icon:sort:fill")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "sort list" }).getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "list menu" }));

    expect(screen.getByTestId("icon:more:fill")).toBeTruthy();
    expect(screen.getByTestId("icon:sort")).toBeTruthy();
  });
});
