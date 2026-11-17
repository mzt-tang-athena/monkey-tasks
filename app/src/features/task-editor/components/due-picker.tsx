import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { formatTime, isSameDay, startOfDay } from "@/utils/dates";
import { radii, spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import {
  clockOf,
  dayOf,
  quickDays,
  storedOf,
  type Clock,
} from "../lib/when";
import { DateGrid, TimeFace } from "./date-pieces";

/** The time a new reminder or a first time starts at. */
export const DEFAULT_CLOCK: Clock = { hour: 9, minute: 0 };

/**
 * The Due picker. A quick day writes at once and keeps the time the
 * task has. A day on the grid waits for Done. The time row adds or
 * removes the time of day, and Clear removes the due.
 */
export function DuePicker({
  due,
  today,
  onChange,
  onClear,
  onDone,
}: {
  due: string | null;
  today: Date;
  onChange: (due: string) => void;
  onClear: () => void;
  onDone: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [day, setDay] = React.useState<Date | null>(() => dayOf(due));
  const [clock, setClock] = React.useState<Clock | null>(() => clockOf(due));
  const [month, setMonth] = React.useState<Date>(
    () => dayOf(due) ?? startOfDay(today),
  );
  /** A day or time chosen here and not written yet. */
  const [dirty, setDirty] = React.useState(false);

  const pickQuick = (next: Date) => {
    setDay(next);
    setMonth(next);
    setDirty(false);
    onChange(storedOf(next, clock));
  };

  const pickDay = (next: Date) => {
    setDay(next);
    setMonth(next);
    setDirty(true);
  };

  return (
    <View style={styles.body}>
      <View style={styles.quick}>
        {quickDays(today).map(({ label, day: quick }) => {
          const chosen = isSameDay(quick, day);
          return (
            <Pressable
              key={label}
              style={({ pressed }) => [
                styles.quickChip,
                chosen && styles.quickChosen,
                pressed && !chosen && styles.pressed,
              ]}
              onPress={() => pickQuick(quick)}
              accessibilityRole="button"
              accessibilityLabel={label}
              aria-pressed={chosen}
            >
              <Text style={[styles.quickText, chosen && styles.quickTextChosen]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <DateGrid
        picked={day}
        today={today}
        month={month}
        onMonth={setMonth}
        onPick={pickDay}
      />
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Time</Text>
        {clock == null ? (
          <Button
            variant="text"
            label="Add a time"
            accessibilityLabel="add a time"
            onPress={() => {
              // The time writes as soon as it shows, so the tile and the
              // alerts read the datetime without another tap.
              setClock(DEFAULT_CLOCK);
              if (day != null) {
                onChange(storedOf(day, DEFAULT_CLOCK));
              }
            }}
          />
        ) : (
          <View style={styles.timeSet}>
            <Text style={styles.timeValue}>
              {formatTime(
                new Date(2026, 0, 1, clock.hour, clock.minute),
              )}
            </Text>
            <Button
              variant="text"
              tone="muted"
              label="Remove"
              accessibilityLabel="remove the time"
              onPress={() => {
                setClock(null);
                if (due != null && day != null) {
                  onChange(storedOf(day, null));
                }
              }}
            />
          </View>
        )}
      </View>
      {clock == null ? null : (
        <TimeFace
          clock={clock}
          onChange={(next) => {
            setClock(next);
            if (day != null) {
              setDirty(false);
              onChange(storedOf(day, next));
            }
          }}
        />
      )}
      <View style={styles.footer}>
        {due == null ? null : (
          <Button
            variant="text"
            tone="danger"
            label="Clear"
            accessibilityLabel="clear due date"
            onPress={onClear}
          />
        )}
        <View style={styles.spacer} />
        <Button
          label="Done"
          accessibilityLabel="done with the date"
          onPress={() => {
            if (day != null && dirty) {
              onChange(storedOf(day, clock));
            }
            onDone();
          }}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    body: {
      gap: spacing.m,
    },
    quick: {
      flexDirection: "row",
      gap: spacing.s,
    },
    quickChip: {
      flex: 1,
      minHeight: touchTarget,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.s,
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
    },
    quickChosen: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentSoft,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    quickText: {
      ...type.control,
      fontWeight: "600",
      color: colors.ink,
    },
    quickTextChosen: {
      color: colors.accent,
    },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    timeLabel: {
      flex: 1,
      ...type.control,
      fontWeight: "600",
      color: colors.ink,
    },
    timeSet: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    timeValue: {
      ...type.control,
      color: colors.inkMuted,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    spacer: {
      flex: 1,
    },
  }),
});
