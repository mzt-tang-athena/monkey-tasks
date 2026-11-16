import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { Icon } from "./icon";
import { Pressable } from "./pressable";

export type SectionTone = "accent" | "danger" | "muted" | "faint";

/**
 * The eyebrow label over a group of rows, with an optional count:
 * "TODAY  3". It holds no spacing of its own; the list around it sets
 * the space above and below. Assistive tech reads it as a header.
 *
 * Given `expanded`, it becomes a disclosure: the label, the count and a
 * chevron on one 44pt row. With `onPress` the row is a button that
 * reports its state, and without it the row is still, for a preview.
 */
export function SectionHeader({
  label,
  count,
  tone = "accent",
  expanded,
  onPress,
}: {
  label: string;
  count?: number;
  tone?: SectionTone;
  /** Whether the group shows its rows. Leave it out for a plain label. */
  expanded?: boolean;
  /** Open or close the group. Leave it out for a still disclosure. */
  onPress?: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const text = (
    <Text style={[styles.label, styles[tone]]}>
      {label}
      {count != null ? `  ${count}` : null}
    </Text>
  );

  if (expanded === undefined) {
    return (
      <Text accessibilityRole="header" style={[styles.label, styles[tone]]}>
        {label}
        {count != null ? `  ${count}` : null}
      </Text>
    );
  }

  const row = (
    <>
      {text}
      <FoldChevron open={expanded} />
    </>
  );
  if (onPress == null) {
    return <View style={styles.disclosure}>{row}</View>;
  }
  return (
    <Pressable
      style={({ pressed }) => [
        styles.disclosure,
        pressed && styles.disclosurePressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        count == null
          ? label
          : `${label} ${count} ${count === 1 ? "task" : "tasks"}`
      }
      aria-expanded={expanded}
    >
      {row}
    </Pressable>
  );
}

/** The chevron turns from right to down on the app's one clock. */
function FoldChevron({ open }: { open: boolean }) {
  const turn = useProgress(open, { ms: motion.ms.settle });
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + 90 * turn.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Icon name="chevron-down" color="inkFaint" />
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
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
    // The whole row is the target, so a finger near the label still
    // opens the group.
    disclosure: {
      alignSelf: "stretch",
      minHeight: touchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    disclosurePressed: {
      opacity: 0.7,
    },
  }),
});
