import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "@/components/ui/pill";
import { CaptureChips } from "./capture-chips";

describe("CaptureChips", () => {
  it("draws nothing for a line with no date", () => {
    const { container } = render(<CaptureChips parsed={{ name: "Buy stamps" }} />);

    expect(container.textContent).toBe("");
  });

  it("draws one Pill chip per parsed field, each with its glyph", () => {
    render(
      <CaptureChips
        parsed={{
          name: "Buy stamps",
          due: "2026-10-30T17:00",
          reminders: ["2026-10-30T17:00"],
          recurrence: "FREQ=WEEKLY",
        }}
      />,
    );

    expect(screen.getByText("Fri 30")).toBeTruthy();
    expect(screen.getByText("5:00 PM")).toBeTruthy();
    expect(screen.getByText("weekly")).toBeTruthy();
    expect(screen.getByTestId("icon:calendar-mini")).toBeTruthy();
    expect(screen.getByTestId("icon:clock-mini")).toBeTruthy();
    expect(screen.getByTestId("icon:repeat")).toBeTruthy();
    // The chips are read-only feedback: nothing to press.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("draws the same chip a bare Pill draws", () => {
    render(<CaptureChips parsed={{ name: "Buy stamps", due: "2026-10-30" }} />);
    render(<Pill tone="chip" label="Fri 30" />);

    const [fromChips, fromPill] = screen.getAllByText("Fri 30");
    // Same classes on the chip and its label: the look is the Pill's.
    expect(fromChips.className).toBe(fromPill.className);
    expect(fromChips.parentElement!.className).toBe(fromPill.parentElement!.className);
  });
});
