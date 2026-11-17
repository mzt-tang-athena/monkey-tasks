import * as React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Palette } from "@/theme/tokens";
import { useTheme } from "@/theme/theme-provider";
import { GLYPHS, type GlyphName } from "./glyphs";

export type IconName = GlyphName;

/** How a glyph draws: the outline at rest, or the solid mark when the
    control it sits in is selected. */
export type GlyphWeight = "outline" | "fill";

/**
 * The app's glyphs, drawn from Phosphor's path data on its 256 grid
 * (ADR 20261117-phosphor-glyphs). Each glyph keeps the box it had where
 * it first appeared, and takes its color from a palette key. An icon is
 * decoration: the control around it carries the name for assistive tech.
 */
export function Icon({
  name,
  color = "inkMuted",
  weight = "outline",
  size,
}: {
  name: IconName;
  /** Every glyph has both drawings. */
  weight?: GlyphWeight;
  color?: keyof Palette;
  /**
   * A square box the glyph fills, centered, for a glyph that sits
   * beside a line of text. Without it the glyph keeps its own size.
   */
  size?: number;
}) {
  const { colors } = useTheme();
  const glyph = GLYPHS[name];
  const side = size ?? glyph.size;
  const drawn = weight === "fill" ? glyph.fill : glyph.regular;
  return (
    <View
      testID={`icon:${name}${weight === "fill" ? ":fill" : ""}`}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={size == null ? undefined : [styles.box, { width: size, height: size }]}
    >
      <Svg width={side} height={side} viewBox="0 0 256 256">
        <Path d={drawn} fill={colors[color]} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
});
