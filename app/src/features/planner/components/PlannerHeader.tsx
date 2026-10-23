import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Mode } from "../model";
import { colors, fonts, radius, spacing } from "../../../theme/tokens";
import { PeriodStrip } from "./PeriodStrip";

const styles = StyleSheet.create({
  pressedFill: {
    backgroundColor: colors.pressed,
  },
  // segmented toggle, E's tighter spacing
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 3,
    marginBottom: spacing.m,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  // Square corners on a selected segment's open sides; the closed
  // sides keep the shared radius.
  segmentFirst: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentMiddle: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentLast: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  segmentText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  segmentTextActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },
});

/** The shared top block: period strip and the mode pills. */
export function PlannerHeader({
  mode,
  selected,
  today,
  onSelect,
  onMode,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  onMode: (mode: Mode) => void;
}) {
  return (
    <View>
      {/* Period strip above the pills: days, weeks, or months to
          match the mode. Tapping a period jumps to it. */}
      <PeriodStrip
        mode={mode}
        selected={selected}
        today={today}
        onSelect={onSelect}
      />

      {/* E's economy: the toggle pills lead the header block. */}
      <View style={styles.segmented}>
        {(["day", "week", "month"] as Mode[]).map((option, index) => (
          <Pressable
            key={option}
            style={({ pressed }) => [
              styles.segment,
              mode === option && styles.segmentActive,
              pressed && styles.pressedFill,
              // Square corners on the selected segment's open sides.
              mode === option &&
                (index === 0
                  ? styles.segmentFirst
                  : index === 2
                    ? styles.segmentLast
                    : styles.segmentMiddle),
            ]}
            onPress={() => onMode(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === option }}
          >
            <Text
              style={[
                styles.segmentText,
                mode === option && styles.segmentTextActive,
              ]}
            >
              {option === "day" ? "Day" : option === "week" ? "Week" : "Month"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
