import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { StyleSheet, Text } from "react-native";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/theme/palettes";
import { MotionScrollView } from "./scroll-view";
import { ScrollEdge, type ScrollOffset, useScrollEdgeOffset } from "./scroll-edge";

/** jsdom reports colors as rgb(); the palette holds hex. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Let the line's own clock run to its end. */
async function settle(ms = 300) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function opacity(id: string) {
  return Number(getComputedStyle(screen.getByTestId(id)).opacity);
}

describe("ScrollEdge", () => {
  it("draws the palette hairline at the top of the box, taking no press", () => {
    render(<ScrollEdge testID="edge" />);

    const edge = screen.getByTestId("edge");
    const style = getComputedStyle(edge);
    expect(style.backgroundColor).toBe(rgb(THEMES.budget.hairline));
    expect(style.position).toBe("absolute");
    expect(style.top).toBe("0px");
    expect(style.height).toBe(`${StyleSheet.hairlineWidth}px`);
    expect(style.pointerEvents).toBe("none");
    expect(opacity("edge")).toBe(1);
  });

  it("hides a still line the page has not scrolled past", () => {
    render(<ScrollEdge testID="edge" shown={false} />);

    expect(opacity("edge")).toBe(0);
  });

  it("shows once the scroller leaves its top, and hides again at the top", async () => {
    let offset: ScrollOffset;
    function Harness() {
      offset = useScrollEdgeOffset();
      return <ScrollEdge testID="edge" offset={offset} />;
    }
    render(<Harness />);
    expect(opacity("edge")).toBe(0);

    await act(async () => {
      offset.value = 120;
    });
    await settle();
    expect(opacity("edge")).toBe(1);

    await act(async () => {
      offset.value = 0;
    });
    await settle();
    expect(opacity("edge")).toBe(0);
  });

  it("follows its scroller with no re-render, and rests at the top", async () => {
    let renders = 0;
    function Harness() {
      renders += 1;
      const offset = useScrollEdgeOffset();
      return (
        <>
          <MotionScrollView testID="scroller" offset={offset} style={{ height: 100 }}>
            <Text>hours</Text>
          </MotionScrollView>
          <ScrollEdge testID="edge" offset={offset} />
        </>
      );
    }
    render(<Harness />);
    const scroller = screen.getByTestId("scroller");
    expect(opacity("edge")).toBe(0);

    await act(async () => {
      scroller.scrollTop = 120;
      scroller.dispatchEvent(new Event("scroll"));
    });
    await settle();
    expect(opacity("edge")).toBe(1);
    expect(renders).toBe(1);

    await act(async () => {
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event("scroll"));
    });
    await settle();
    expect(opacity("edge")).toBe(0);
    expect(renders).toBe(1);
  });
});
