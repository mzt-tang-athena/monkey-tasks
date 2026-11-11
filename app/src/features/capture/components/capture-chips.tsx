import { StyleSheet, View } from "react-native";
import type { ParsedCapture } from "@/types/task";
import {
  dueChipLabel,
  recurrenceKeyword,
  timeChipLabel,
} from "@/features/capture/lib/chip-labels";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { spacing } from "@/theme/tokens";

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
      <Pill tone="chip" label={dueChipLabel(parsed.due)}>
        <Icon name="calendar-mini" color="accent" />
      </Pill>
      {parsed.reminders != null && parsed.reminders.length > 0 ? (
        <Pill tone="chip" label={timeChipLabel(parsed.due)}>
          <Icon name="clock-mini" color="accent" />
        </Pill>
      ) : null}
      {parsed.recurrence ? (
        <Pill tone="chip" label={recurrenceKeyword(parsed.recurrence)}>
          <Icon name="repeat" color="accent" />
        </Pill>
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
});
