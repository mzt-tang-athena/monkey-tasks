import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl, type Segment } from "@/components/ui/segmented-control";
import type { Mode } from "@/features/planner/model";
import { pageGutter, spacing } from "@/theme/tokens";
import { PeriodStrip } from "./period-strip";

const segments: Segment<Mode>[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

/**
 * The shared top block: period strip and the mode switch. With `inset`
 * the header takes the page gutter itself, so the week and month
 * rails can run to the screen's edges. The day view's frame holds the
 * gutter for it instead.
 */
export function PlannerHeader({
  mode,
  selected,
  today,
  onSelect,
  onMode,
  inset = false,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  onMode: (mode: Mode) => void;
  inset?: boolean;
}) {
  return (
    <View style={styles.header}>
      {/* Period strip above the switch: days, weeks, or months to
          match the mode. Tapping a period jumps to it. */}
      <PeriodStrip
        mode={mode}
        selected={selected}
        today={today}
        onSelect={onSelect}
      />

      <View style={inset && styles.gutter}>
        <View style={styles.modeRow}>
          <View style={styles.modeControl}>
            <SegmentedControl
              segments={segments}
              selected={mode}
              onSelect={onMode}
              label="planner mode"
              stretch
            />
          </View>
          <IconButton
            label="open settings"
            onPress={() => router.push("/settings")}
          >
            <Icon name="settings" />
          </IconButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The strip and the mode switch, one step apart. The screen spaces
  // the header from what follows.
  header: {
    gap: spacing.s,
  },
  gutter: {
    paddingHorizontal: pageGutter,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  modeControl: {
    flex: 1,
  },
});
