import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Text, View } from "react-native";
import type { MarkPlace } from "@/lib/motion/mark-math";
import { usePageFollow } from "./page-follow";
import { TabUnderline } from "./tab-underline";

const boxes: MarkPlace[] = [
  { x: 0, width: 68 },
  { x: 76, width: 100 },
  { x: 184, width: 84 },
];

/** A strip's content, with a pager's follow the test drives. */
function Tracked({ cut = false }: { cut?: boolean }) {
  const follow = usePageFollow();
  return (
    <View>
      <TabUnderline
        follow={follow}
        selected={0}
        boxes={boxes}
        inset={12}
        testID="bar"
      />
      <Text
        testID="half"
        onPress={() => follow.progress.set(cut ? 2 : 0.5)}
      >
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

function bar() {
  return screen.getByTestId("bar");
}

describe("TabUnderline", () => {
  it("blends to halfway between two tabs on a half page", async () => {
    render(<Tracked />);
    await frame();
    fireEvent.click(screen.getByTestId("half"));
    await frame();

    // Main's rule spans 12 to 56. Errands' spans 88 to 164.
    expect(parseFloat(bar().style.left)).toBeCloseTo(50, 0);
    expect(parseFloat(bar().style.width)).toBeCloseTo(60, 0);
  });

  it("sits back under the tab at rest", async () => {
    render(<Tracked />);
    await frame();
    fireEvent.click(screen.getByTestId("half"));
    await frame();
    fireEvent.click(screen.getByTestId("rest"));
    await frame();

    expect(parseFloat(bar().style.left)).toBeCloseTo(12, 0);
    expect(parseFloat(bar().style.width)).toBeCloseTo(44, 0);
  });

  it("settles on a tab a page cut reaches", async () => {
    render(<Tracked cut />);
    await frame();
    fireEvent.click(screen.getByTestId("half"));
    await frame(400);

    expect(parseFloat(bar().style.left)).toBeCloseTo(196, 0);
    expect(parseFloat(bar().style.width)).toBeCloseTo(60, 0);
  });
});
