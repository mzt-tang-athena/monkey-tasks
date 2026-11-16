import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { isSameDay } from "@/utils/dates";
import { radii, spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { dayHour, faceHour, monthRows, type Clock } from "../lib/when";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** A day's full name, for a grid cell's accessible name. */
export function dayName(day: Date): string {
  return `${WEEKDAY_NAMES[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

/**
 * One month as a grid of days, Sunday first. The picked day fills with
 * the accent and today reads in it. The arrows step a month.
 */
export function DateGrid({
  picked,
  today,
  month,
  onMonth,
  onPick,
}: {
  picked: Date | null;
  today: Date;
  /** Any day in the month on show. */
  month: Date;
  onMonth: (month: Date) => void;
  onPick: (day: Date) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const step = (by: number) =>
    onMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  return (
    <View style={styles.grid}>
      <View style={styles.monthRow}>
        <IconButton label="previous month" onPress={() => step(-1)}>
          <View style={styles.back}>
            <Icon name="chevron-right" />
          </View>
        </IconButton>
        <Text style={styles.monthTitle} aria-live="polite">
          {`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
        </Text>
        <IconButton label="next month" onPress={() => step(1)}>
          <Icon name="chevron-right" />
        </IconButton>
      </View>
      <View style={styles.week} aria-hidden>
        {WEEKDAY_LETTERS.map((letter, at) => (
          <Text key={at} style={styles.weekday}>
            {letter}
          </Text>
        ))}
      </View>
      {monthRows(month).map((row, at) => (
        <View key={at} style={styles.week}>
          {row.map((day, column) =>
            day == null ? (
              <View key={column} style={styles.cell} />
            ) : (
              <DayCell
                key={column}
                day={day}
                picked={isSameDay(day, picked)}
                today={isSameDay(day, today)}
                onPress={() => onPick(day)}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function DayCell({
  day,
  picked,
  today,
  onPress,
}: {
  day: Date;
  picked: boolean;
  today: boolean;
  onPress: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && !picked && styles.cellPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dayName(day)}${today ? ", today" : ""}`}
      aria-pressed={picked}
    >
      <View style={[styles.dot, picked && styles.dotPicked]}>
        <Text
          style={[
            styles.dayText,
            today && styles.todayText,
            picked && styles.pickedText,
          ]}
        >
          {day.getDate()}
        </Text>
      </View>
    </Pressable>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "15", "30", "45"] as const;

/**
 * A time as three choices: the hour on a twelve hour face, the quarter
 * hour, and AM or PM. A minute off the quarters picks no quarter until
 * the user picks one.
 */
export function TimeFace({
  clock,
  onChange,
}: {
  clock: Clock;
  onChange: (clock: Clock) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const pm = clock.hour >= 12;
  const face = faceHour(clock.hour);
  const minute = String(clock.minute).padStart(2, "0");
  return (
    <View style={styles.face}>
      <View role="tablist" aria-label="hour" style={styles.hours}>
        {[HOURS.slice(0, 6), HOURS.slice(6)].map((row, at) => (
          <View key={at} style={styles.week}>
            {row.map((hour) => {
              const chosen = hour === face;
              return (
                <Pressable
                  key={hour}
                  style={({ pressed }) => [
                    styles.hour,
                    chosen && styles.hourChosen,
                    pressed && !chosen && styles.cellPressed,
                  ]}
                  onPress={() => onChange({ ...clock, hour: dayHour(hour, pm) })}
                  role="tab"
                  aria-selected={chosen}
                  accessibilityLabel={`${hour} o'clock`}
                >
                  <Text style={[styles.dayText, chosen && styles.pickedText]}>
                    {hour}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <SegmentedControl
        label="minutes"
        stretch
        segments={MINUTES.map((key) => ({ key, label: `:${key}` }))}
        selected={minute}
        onSelect={(key) => onChange({ ...clock, minute: Number(key) })}
      />
      <SegmentedControl
        label="half of the day"
        stretch
        segments={[
          { key: "am", label: "AM" },
          { key: "pm", label: "PM" },
        ]}
        selected={pm ? "pm" : "am"}
        onSelect={(key) =>
          onChange({ ...clock, hour: dayHour(face, key === "pm") })
        }
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    grid: {
      gap: spacing.xs,
    },
    monthRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    monthTitle: {
      flex: 1,
      textAlign: "center",
      ...type.control,
      fontWeight: "600",
      color: colors.ink,
    },
    back: {
      transform: [{ rotate: "180deg" }],
    },
    week: {
      flexDirection: "row",
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      ...type.caption,
      fontWeight: "600",
      color: colors.inkMuted,
    },
    cell: {
      flex: 1,
      height: touchTarget,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.pill,
    },
    cellPressed: {
      backgroundColor: colors.pressed,
    },
    dot: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    dotPicked: {
      backgroundColor: colors.accent,
    },
    dayText: {
      ...type.control,
      color: colors.ink,
    },
    todayText: {
      color: colors.accent,
      fontWeight: "700",
    },
    pickedText: {
      color: colors.onAccent,
      fontWeight: "700",
    },
    face: {
      gap: spacing.s,
    },
    hours: {
      gap: spacing.xs,
    },
    hour: {
      flex: 1,
      height: touchTarget,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.pill,
    },
    hourChosen: {
      backgroundColor: colors.accent,
    },
  }),
});
