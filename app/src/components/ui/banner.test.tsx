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

  it("runs each action under the name it is given", () => {
    const retry = vi.fn();
    const dismiss = vi.fn();
    render(
      <Banner
        tone="danger"
        lines={["Save failed."]}
        actions={[
          { label: "Retry", accessibilityLabel: "retry tick", onPress: retry },
          { label: "Dismiss", accessibilityLabel: "dismiss error", onPress: dismiss },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "dismiss error" }));

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "retry tick" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("has no button without an action", () => {
    render(<Banner tone="info" lines={["Saved."]} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
