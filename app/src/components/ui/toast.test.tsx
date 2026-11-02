import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Text } from "react-native";
import { layers } from "@/theme/tokens";
import { OverlayHost } from "./overlay-host";
import { Toast } from "./toast";

describe("Toast", () => {
  it("reports role alert and floats at the toast layer", () => {
    render(
      <OverlayHost>
        <Text>page</Text>
        <Toast message="The capture was not saved." bottom={80} />
      </OverlayHost>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("The capture was not saved.");
    // React Native Web gives every view z-index 0, so the layer is
    // the nearest ancestor with a real one.
    let layer: HTMLElement | null = alert;
    while (layer != null && ["", "auto", "0"].includes(getComputedStyle(layer).zIndex)) {
      layer = layer.parentElement;
    }
    expect(Number(getComputedStyle(layer!).zIndex)).toBe(layers.toast);
  });

  it("runs each of its two actions", () => {
    const retry = vi.fn();
    const dismiss = vi.fn();
    render(
      <OverlayHost>
        <Toast
          message="The capture was not saved."
          bottom={80}
          actions={[
            { label: "Retry", accessibilityLabel: "retry capture", onPress: retry },
            { label: "Dismiss", accessibilityLabel: "dismiss capture failure", onPress: dismiss },
          ]}
        />
      </OverlayHost>,
    );

    fireEvent.click(screen.getByRole("button", { name: "retry capture" }));
    fireEvent.click(screen.getByRole("button", { name: "dismiss capture failure" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
