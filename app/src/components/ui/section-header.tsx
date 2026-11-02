import * as React from "react";
import { StyleSheet, Text } from "react-native";
import { colors, type } from "@/theme/tokens";

export type SectionTone = "accent" | "danger" | "muted" | "faint";

/**
 * The eyebrow label over a group of rows, with an optional count:
 * "TODAY  3". It holds no spacing of its own; the list around it sets
 * the space above and below. Assistive tech reads it as a header.
 */
export function SectionHeader({
  label,
  count,
  tone = "accent",
}: {
  label: string;
  count?: number;
  tone?: SectionTone;
}) {
  return (
    <Text accessibilityRole="header" style={[styles.label, styles[tone]]}>
      {label}
      {count != null ? `  ${count}` : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.eyebrow,
  },
  accent: {
    color: colors.accent,
  },
  danger: {
    color: colors.danger,
  },
  muted: {
    color: colors.inkMuted,
  },
  // Done work recedes: the faint ink, dimmed again.
  faint: {
    color: colors.inkFaint,
    opacity: 0.55,
  },
});
