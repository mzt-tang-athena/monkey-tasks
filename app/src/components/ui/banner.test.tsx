import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Banner } from "./banner";

describe("Banner", () => {
  it("reports role alert and reads politely", () => {
    render(<Banner tone="danger" lines={["The note could not be written."]} />);

    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("aria-live")).toBe("polite");
    expect(alert.textContent).toBe("The note could not be written.");
  });

  it("shows its title and lines in order", () => {
    render(
      <Banner tone="info" title="Needs repair" lines={["Garden.md", "kind is missing"]} />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "Needs repairGarden.mdkind is missing",
    );
  });

  it("runs its action under the name it is given", () => {
    const onPress = vi.fn();
    render(
      <Banner
        tone="danger"
        lines={["Save failed."]}
        action={{ label: "Dismiss", accessibilityLabel: "dismiss error", onPress }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "dismiss error" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("has no button without an action", () => {
    render(<Banner tone="info" lines={["Saved."]} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
