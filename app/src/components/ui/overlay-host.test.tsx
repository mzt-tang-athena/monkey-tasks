import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Text, View } from "react-native";
import { layers } from "@/theme/tokens";
import { Overlay, OverlayHost } from "./overlay-host";

/** The z index of the layer an overlay draws in. */
function zOf(text: string): number {
  let node: HTMLElement | null = screen.getByText(text);
  while (node != null) {
    const z = getComputedStyle(node).zIndex;
    // React Native Web gives every view z-index 0.
    if (z !== "" && z !== "auto" && z !== "0") {
      return Number(z);
    }
    node = node.parentElement;
  }
  return Number.NaN;
}

describe("OverlayHost", () => {
  it("draws overlays after the screen, at their layer", () => {
    render(
      <OverlayHost>
        <View testID="screen">
          <Overlay layer="toast">
            <Text>toast</Text>
          </Overlay>
          <Overlay layer="menu">
            <Text>menu</Text>
          </Overlay>
        </View>
      </OverlayHost>,
    );

    // The overlays leave the screen's tree for the host's.
    expect(screen.getByTestId("screen").textContent).toBe("");
    expect(zOf("menu")).toBe(layers.menu);
    expect(zOf("toast")).toBe(layers.toast);
    // The host draws them in layer order, low to high.
    const menu = screen.getByText("menu");
    const toast = screen.getByText("toast");
    expect(menu.compareDocumentPosition(toast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides the screen from assistive tech only while a modal overlay shows", () => {
    function Harness({ modal }: { modal: boolean }) {
      return (
        <OverlayHost>
          <Text>screen</Text>
          <Overlay layer="toast">
            <Text>note</Text>
          </Overlay>
          {modal ? (
            <Overlay layer="sheet" modal>
              <Text>sheet</Text>
            </Overlay>
          ) : null}
        </OverlayHost>
      );
    }
    const { rerender } = render(<Harness modal={false} />);
    expect(screen.getByText("screen").closest('[aria-hidden="true"]')).toBeNull();

    rerender(<Harness modal />);
    expect(screen.getByText("screen").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText("sheet").closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByText("note").closest('[aria-hidden="true"]')).toBeNull();

    rerender(<Harness modal={false} />);
    expect(screen.queryByText("sheet")).toBeNull();
    expect(screen.getByText("screen").closest('[aria-hidden="true"]')).toBeNull();
  });

  it("keeps an overlay's state while its content updates", () => {
    function Counter({ label }: { label: string }) {
      const [mounted] = React.useState(() => Math.random());
      return <Text testID="counter">{`${label} ${mounted}`}</Text>;
    }
    function Harness({ label }: { label: string }) {
      return (
        <OverlayHost>
          <Overlay layer="sheet">
            <Counter label={label} />
          </Overlay>
        </OverlayHost>
      );
    }
    const { rerender } = render(<Harness label="a" />);
    const first = screen.getByTestId("counter").textContent!.split(" ")[1];

    rerender(<Harness label="b" />);

    const [label, seed] = screen.getByTestId("counter").textContent!.split(" ");
    expect(label).toBe("b");
    expect(seed).toBe(first);
  });

  it("draws in place at its layer without a host", () => {
    render(
      <Overlay layer="toast">
        <Text>alone</Text>
      </Overlay>,
    );

    expect(zOf("alone")).toBe(layers.toast);
  });
});
