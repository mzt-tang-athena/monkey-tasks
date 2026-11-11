import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "./list-states";

describe("list states", () => {
  it("LoadingState reports a busy progress bar", () => {
    render(<LoadingState label="Loading tasks" />);

    const bar = screen.getByRole("progressbar", { name: "Loading tasks" });
    expect(bar.getAttribute("aria-busy")).toBe("true");
  });

  it("EmptyState shows its label", () => {
    render(<EmptyState label="Nothing on this list yet." />);

    expect(screen.getByText("Nothing on this list yet.")).toBeTruthy();
  });

  it("ErrorState reports an alert and retries from its button", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        message="Something went wrong."
        retryLabel="Retry loading tasks"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading tasks" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
