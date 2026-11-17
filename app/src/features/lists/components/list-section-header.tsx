import * as React from "react";
import { StyleSheet, View } from "react-native";
import {
  SectionHeader,
  type SectionTone as HeaderTone,
} from "@/components/ui/section-header";
import type { SectionTone } from "@/stores/tasks/selectors";
import { spacing } from "@/theme/tokens";

/** The store names a plain group's tone "ink"; the header names it
    "accent". */
function headerTone(tone: SectionTone | "faint"): HeaderTone {
  return tone === "ink" ? "accent" : tone;
}

/**
 * A group's header with the space the list owes it: the gap above the
 * group and the gap between the label and its first row (ADR 0012). A
 * `SectionList` has no gap between sections, so the header slot sets
 * it. The live list and the swipe preview both draw it, so they line
 * up.
 *
 * `expanded` makes the Completed header a disclosure. The still
 * preview passes it without `onToggle`, so both draw the same row.
 */
export function ListSectionHeader({
  title,
  count,
  tone,
  expanded,
  onToggle,
}: {
  title: string;
  count: number;
  tone: SectionTone | "faint";
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <View style={[styles.slot, tone === "faint" && styles.slotFaint]}>
      <SectionHeader
        label={title}
        count={count}
        tone={headerTone(tone)}
        expanded={expanded}
        onPress={onToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.s,
  },
  // The Completed label sits closer to its rows.
  slotFaint: {
    paddingBottom: spacing.xs,
  },
});
