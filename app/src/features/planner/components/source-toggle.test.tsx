import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextSource, type Source } from "@/features/planner/model";
import { TestPlannerList } from "@/features/planner/testing/test-planner-list";
import { SourceToggle } from "./source-toggle";

// The harness owns the source state and cycles it through the same
// model helper the screen uses.
function Harness() {
  const [source, setSource] = React.useState<Source>("due-period");
  return (
    <TestPlannerList
      value={{ source, cycleSource: () => setSource(nextSource) }}
    >
      <SourceToggle mode="day" day={new Date(2026, 9, 26)} />
    </TestPlannerList>
  );
}

/** The one control the chip renders. */
function chip(): HTMLElement {
  return screen.getByRole("button", { name: /^task source:/ });
}

/** React Native Web starts a press 50 ms after the pointer lands. */
function pressIn() {
  fireEvent.mouseDown(chip(), { button: 0 });
  act(() => {
    vi.advanceTimersByTime(60);
  });
}

function pressOut() {
  fireEvent.mouseUp(chip(), { button: 0 });
}

describe("SourceToggle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cycles one source per tap", () => {
    render(<Harness />);
    expect(chip().textContent).toContain("Due today");

    pressIn();
    pressOut();
    fireEvent.click(chip());

    expect(chip().textContent).toContain("Focus");
    expect(chip().textContent).not.toContain("Main");
  });

  // Android's Pressability calls onPress on release and delays
  // onPressOut to its 130 ms minimum press duration, so a short tap
  // delivers the action while the chip still says it is pressed. The
  // chip must read the source it chose, not the preview of the one
  // after it: Due today would settle on Focus but flash Main.
  it("reads the chosen source when the action lands before the press-out", () => {
    render(<Harness />);

    pressIn();
    // While held, the chip previews the source the tap will pick.
    expect(chip().textContent).toContain("Focus");

    fireEvent.click(chip());
    expect(chip().textContent).toContain("Focus");
    expect(chip().textContent).not.toContain("Main");

    pressOut();
    expect(chip().textContent).toContain("Focus");
    expect(chip().textContent).not.toContain("Main");
  });

  it("names the period on screen, not the mode", () => {
    render(
      <TestPlannerList>
        <SourceToggle mode="week" day={new Date(2026, 10, 11)} />
      </TestPlannerList>,
    );

    expect(chip().textContent).toContain("Due 8 to 14 Nov");
  });

  it("opens the chooser from its own view when held", () => {
    const openSourceMenu = vi.fn();
    render(
      <TestPlannerList value={{ openSourceMenu }}>
        <SourceToggle mode="day" day={new Date(2026, 9, 26)} />
      </TestPlannerList>,
    );

    pressIn();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(openSourceMenu).toHaveBeenCalledTimes(1);
    expect(openSourceMenu.mock.calls[0][0]).toHaveProperty("current");
  });
});
