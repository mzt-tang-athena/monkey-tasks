import * as React from "react";
import { StyleSheet, View } from "react-native";
import type { Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The fade's steps, from clear to solid, toward the strip's edge. A
    stepped fade needs no gradient library and draws the same on every
    platform. */
const fadeSteps = [0.12, 0.3, 0.52, 0.74, 0.9, 1];
/** Each step's width. */
const fadeStepWidth = 5;
/** How far the fade reaches in from the edge. */
export const edgeFadeWidth = fadeSteps.length * fadeStepWidth;
/** The scroll distance, in px, that counts as past an edge. */
const fadeEdge = 2;

/** Which edges of a sideways scroll hide more content. */
export function fadedEdges(frame: { view: number; content: number; x: number }) {
  return {
    start: frame.x > fadeEdge,
    end: frame.content - frame.view - frame.x > fadeEdge,
  };
}

/**
 * A fade over the edge of a sideways strip, where more items wait past
 * it. A clipped item then reads as "more this way" and not as a bug.
 * The fade paints the surface color, so the strip belongs on a surface.
 * Its parent places it: the fade fills the parent's height at one edge.
 */
export function EdgeFade({ side, testID }: { side: "start" | "end"; testID?: string }) {
  const { styles } = useThemedStyles(makeStyles);
  const steps = side === "end" ? fadeSteps : [...fadeSteps].reverse();
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.fade, side === "end" ? styles.fadeEnd : styles.fadeStart]}
    >
      {steps.map((opacity) => (
        <View key={opacity} style={[styles.fadeStep, { opacity }]} />
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
      width: fadeStepWidth,
      backgroundColor: colors.surface,
    },
  }),
});
