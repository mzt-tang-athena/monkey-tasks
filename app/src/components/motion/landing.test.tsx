import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
import { describe, expect, it } from "vitest";
import { Text } from "react-native";
import { markLanded } from "@/lib/motion/entrances";
import { Landing } from "./landing";

/** The view that carries the entrance: the one around the row. */
function entranceOf(text: string) {
  return screen.getByText(text).parentElement as HTMLElement;
}

describe("Landing", () => {
  it("plays the entrance for a marked row, once", async () => {
    markLanded("task:new");
    const first = render(
      <Landing id="task:new">
        <Text>new</Text>
      </Landing>,
    );
    await waitFor(() => expect(entranceOf("new").style.animationName).not.toBe(""));
    first.unmount();

    render(
      <Landing id="task:new">
        <Text>new</Text>
      </Landing>,
    );
    await settle();
    expect(entranceOf("new").style.animationName).toBe("");
  });

  it("plays nothing for a row with no mark", async () => {
    render(
      <Landing id="task:old">
        <Text>old</Text>
      </Landing>,
    );
    await settle();
    expect(entranceOf("old").style.animationName).toBe("");
  });
});
