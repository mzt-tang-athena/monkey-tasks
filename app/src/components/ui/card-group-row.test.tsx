import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Text } from "react-native";
import { taskRowFace } from "@/components/task-row-face";
import { CardGroupRow, cardPosition, type CardPosition } from "./card-group-row";

function row(position: CardPosition) {
  render(
    <CardGroupRow position={position}>
      <Text>{position}</Text>
    </CardGroupRow>,
  );
  const element = screen.getByText(position).parentElement!;
  return { element, style: getComputedStyle(element) };
}

describe("CardGroupRow", () => {
  it("places each row of a card", () => {
    expect([0, 1, 2].map((index) => cardPosition(index, 3))).toEqual([
      "first",
      "middle",
      "last",
    ]);
    expect(cardPosition(0, 1)).toBe("only");
  });

  it("draws the top edge on the first row and the bottom edge on the last", () => {
    const first = row("first").style;
    expect(parseFloat(first.borderTopWidth)).toBeGreaterThan(0);
    expect(parseFloat(first.borderBottomWidth) || 0).toBe(0);

    const last = row("last").style;
    expect(parseFloat(last.borderTopWidth) || 0).toBe(0);
    expect(parseFloat(last.borderBottomWidth)).toBeGreaterThan(0);

    const only = row("only").style;
    expect(parseFloat(only.borderTopWidth)).toBeGreaterThan(0);
    expect(parseFloat(only.borderBottomWidth)).toBeGreaterThan(0);
  });

  it("draws a divider above every row but the first, inset to the task text", () => {
    const { unmount } = render(
      <CardGroupRow position="first">
        <Text>a</Text>
      </CardGroupRow>,
    );
    expect(screen.queryByTestId("card-divider")).toBeNull();
    unmount();

    row("middle");
    const divider = screen.getByTestId("card-divider");
    expect(parseFloat(getComputedStyle(divider).left)).toBe(taskRowFace.textInset);
  });
});
