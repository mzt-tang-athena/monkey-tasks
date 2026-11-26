import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** Each ramp step's width. */
const stepWidth = 4;
/** The most steps a ramp takes. */
const maxSteps = 5;
/** The scroll distance, in px, that counts as past an edge. */
const fadeEdge = 2;
/** The clear space the fade leaves before the first whole item. */
const clearance = 4;
/** A name closer to the edge than this has no room for the fade's
    first step, so the cover takes it too. */
const lead = clearance + stepWidth;

/** Which edges of a sideways scroll hide more content. A strip that has
    not measured its view yet hides nothing. */
export function fadedEdges(frame: { view: number; content: number; x: number }) {
  if (frame.view <= 0) {
    return { start: false, end: false };
  }
  return {
    start: frame.x > fadeEdge,
    end: frame.content - frame.view - frame.x > fadeEdge,
  };
}

/** An item's place in the strip's content, in px. */
export type FadeBox = { x: number; width: number };

/** How far a fade reaches in from its edge: a solid cover, then a
    ramp of `steps` steps toward the whole items. */
export type FadeReach = { cover: number; steps: number };

const plainReach: FadeReach = { cover: 0, steps: maxSteps };

/**
 * The fade's reach over one edge of a strip, so it ends on the gap
 * between two items and never inside a name. The cover hides every
 * item the edge cuts, and the ramp fades over the gap before the first
 * whole item. `inset` is each item's padding, `gap` the space between
 * items. Without every item measured, the fade is a plain ramp.
 */
export function fadeReach(
  side: "start" | "end",
  frame: { view: number; x: number },
  boxes: readonly (FadeBox | null)[],
  { inset, gap }: { inset: number; gap: number },
): FadeReach {
  const ink: { start: number; end: number }[] = [];
  for (const box of boxes) {
    if (box == null) {
      return plainReach;
    }
    ink.push({
      start: box.x + inset - frame.x,
      end: box.x + box.width - inset - frame.x,
    });
  }
  const whole =
    side === "start"
      ? ink.find((item) => item.start >= lead)
      : ink.findLast((item) => frame.view - item.end >= lead);
  if (whole == null) {
    return plainReach;
  }
  const reach =
    side === "start"
      ? whole.start - clearance
      : frame.view - whole.end - clearance;
  const room = Math.floor((2 * inset + gap - clearance) / stepWidth);
  const steps = Math.max(1, Math.min(maxSteps, room, Math.floor(reach / stepWidth)));
  return { cover: Math.max(0, reach - steps * stepWidth), steps };
}

/** The ramp's opacities, from clear to solid. */
function ramp(steps: number): number[] {
  return Array.from({ length: steps }, (_, i) => (i + 1) / (steps + 1));
}

/**
 * A fade over the edge of a sideways strip, where more items wait past
 * it. A clipped item then reads as "more this way" and not as a bug.
 * The fade paints the surface color, so the strip belongs on a surface.
 * Its parent places it: the fade fills the parent's height at one edge.
 * `reach` ends it on a gap between items, from `fadeReach`.
 */
export function EdgeFade({
  side,
  reach = plainReach,
  testID,
}: {
  side: "start" | "end";
  reach?: FadeReach;
  testID?: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const steps = ramp(reach.steps);
  const parts = [
    ...steps.map((opacity) => ({ key: `ramp-${opacity}`, width: stepWidth, opacity })),
    { key: "cover", width: reach.cover, opacity: 1 },
  ];
  if (side === "start") {
    parts.reverse();
  }
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.fade, side === "end" ? styles.fadeEnd : styles.fadeStart]}
    >
      {parts.map(({ key, width, opacity }) => (
        <View key={key} style={[styles.fadeStep, { width, opacity }]} />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    fade: {
      position: "absolute",
      top: 0,
      bottom: 0,
      flexDirection: "row",
    },
    fadeStart: {
      left: 0,
    },
    fadeEnd: {
      right: 0,
    },
    fadeStep: {
      backgroundColor: colors.surface,
    },
  }),
});
