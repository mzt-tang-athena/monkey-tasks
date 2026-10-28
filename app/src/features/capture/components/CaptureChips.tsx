import { StyleSheet, Text, View } from "react-native";
import type { ParsedCapture } from "@/types/task";
import {
  dueChipLabel,
  recurrenceKeyword,
  timeChipLabel,
} from "@/features/capture/lib/chipLabels";
import { colors, fonts, radius, radii, spacing } from "@/theme/tokens";

/**
 * The capture sheet's parse feedback: icon chips built from the parse
 * result object, never from text spans. A line with no due date has
 * nothing to show, so the row is absent rather than empty.
 */
export function CaptureChips({
  parsed,
}: {
  parsed?: ParsedCapture | null;
}) {
  if (!parsed?.due) {
    return null;
  }
  return (
    <View style={styles.chipRow}>
      <View style={styles.parseChip}>
        <View style={styles.glyphMiniCalendar}>
          <View style={styles.glyphMiniCalendarTop} />
          <View style={styles.glyphMiniCalendarDot} />
        </View>
        <Text style={styles.parseChipText}>{dueChipLabel(parsed.due)}</Text>
      </View>
      {parsed.reminders != null && parsed.reminders.length > 0 ? (
        <View style={styles.parseChip}>
          <View style={styles.glyphMiniClock}>
            <View style={styles.glyphMiniClockHand} />
            <View style={styles.glyphMiniClockHandV} />
          </View>
          <Text style={styles.parseChipText}>{timeChipLabel(parsed.due)}</Text>
        </View>
      ) : null}
      {parsed.recurrence ? (
        <View style={styles.parseChip}>
          <Text style={styles.parseGlyph}>{"↻"}</Text>
          <Text style={styles.parseChipText}>
            {recurrenceKeyword(parsed.recurrence)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s,
  },
  parseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius,
    paddingHorizontal: spacing.s,
    height: 24,
  },
  parseChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  parseGlyph: {
    fontSize: 12,
    lineHeight: 14,
    color: colors.accent,
    fontWeight: "700",
  },
  glyphMiniCalendar: {
    width: 11,
    height: 11,
    borderWidth: 1.5,
    borderRadius: 3,
    overflow: "hidden",
  },
  glyphMiniCalendarTop: {
    height: 3,
    width: "100%",
    backgroundColor: colors.accent,
  },
  glyphMiniCalendarDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginLeft: 2,
    marginTop: 2,
    backgroundColor: colors.accent,
  },
  glyphMiniClock: {
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  glyphMiniClockHand: {
    position: "absolute",
    left: 4,
    top: 1.5,
    width: 1.5,
    height: 4,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  glyphMiniClockHandV: {
    position: "absolute",
    left: 5.5,
    top: 4,
    width: 3,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
});
