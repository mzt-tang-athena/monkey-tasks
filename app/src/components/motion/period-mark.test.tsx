import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Text, View } from "react-native";
import { usePageFollow } from "./page-follow";
import { PeriodMark, type MarkPlace } from "./period-mark";

const places: MarkPlace[] = [
  { x: 0, width: 44 },
  { x: 52, width: 44 },
  { x: 104, width: 44 },
];

/** A row's mark, with a pager's follow the test drives. */
function Tracked({ cut = false }: { cut?: boolean }) {
  const follow = usePageFollow();
  return (
    <View>
      <PeriodMark follow={follow} at={0} places={places} testID="mark">
        <View testID="copy">
          <Text>Mon</Text>
        </View>
      </PeriodMark>
      <Text testID="half" onPress={() => follow.progress.set(cut ? 2 : 0.5)}>
        move
      </Text>
      <Text testID="rest" onPress={() => follow.progress.set(0)}>
        rest
      </Text>
    </View>
  );
}

/** Give Reanimated's web frame loop a turn. */
async function frame(ms = 80) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function mark() {
  return screen.getByTestId("mark");
}

function shift() {
  return screen.getByTestId("mark:copy").style.transform;
}

describe("PeriodMark", () => {
  it("sits on its cell at rest", async () => {
    render(<Tracked />);
    await frame();

    expect(parseFloat(mark().style.left)).toBeCloseTo(0, 0);
    expect(parseFloat(mark().style.width)).toBeCloseTo(44, 0);
    expect(shift()).toBe("translateX(0px)");
  });

  it("sits halfway between two cells at half a page", async () => {
    render(<Tracked />);
    await frame();
    fireEvent.click(screen.getByTestId("half"));
    await frame();

    expect(parseFloat(mark().style.left)).toBeCloseTo(26, 0);
    expect(parseFloat(mark().style.width)).toBeCloseTo(44, 0);
    // The copied labels keep the row's own places.
    expect(shift()).toBe("translateX(-26px)");
  });

  it("sits back on its cell when the page returns", async () => {
    render(<Tracked />);
    await frame();
    fireEvent.click(screen.getByTestId("half"));
    await frame();
    fireEvent.click(screen.getByTestId("rest"));
    await frame();

    expect(parseFloat(mark().style.left)).toBeCloseTo(0, 0);
  });

  it("crosses to a cell a cut lands on", async () => {
    render(<Tracked cut />);
    await frame();
    fireEvent.click(screen.getByTestId("half"));
    await frame(400);

    expect(parseFloat(mark().style.left)).toBeCloseTo(104, 0);
    expect(shift()).toBe("translateX(-104px)");
  });
});
