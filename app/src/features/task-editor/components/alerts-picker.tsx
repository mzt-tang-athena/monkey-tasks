import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import type { AlertWeight } from "@monkey-tasks/schemas";
import { startOfDay } from "@/utils/dates";
import { radius, spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { clockOf, dayOf, storedOf, whenWords, type Clock } from "../lib/when";
import { DateGrid, TimeFace } from "./date-pieces";
import { DEFAULT_CLOCK } from "./due-picker";

/**
 * The Alerts picker: the timed due as "At due", then one row per
 * reminder with its remove control. Add reminder opens the same day
 * grid and time face as the Due picker, and the new reminder writes as
 * soon as it is added. The Alarm switch under them covers every alert of
 * the task, and writes as soon as it is flipped.
 */
export function AlertsPicker({
  reminders,
  due,
  weight,
  today,
  onChange,
  onWeight,
}: {
  reminders: string[];
  due: string | null;
  weight: AlertWeight;
  today: Date;
  onChange: (reminders: string[]) => void;
  onWeight: (weight: AlertWeight) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [adding, setAdding] = React.useState(false);
  const [day, setDay] = React.useState<Date>(
    () => dayOf(due) ?? startOfDay(today),
  );
  const [month, setMonth] = React.useState<Date>(
    () => dayOf(due) ?? startOfDay(today),
  );
  const [clock, setClock] = React.useState<Clock>(
    () => clockOf(due) ?? DEFAULT_CLOCK,
  );
  const sorted = [...reminders].sort();
  const atDue = clockOf(due) != null;

  const remove = (at: string) => onChange(reminders.filter((one) => one !== at));
  const add = () => {
    onChange([...reminders, storedOf(day, clock)].sort());
    setAdding(false);
  };

  return (
    <View style={styles.body}>
      {/* The timed due rings by itself, so its row has no remove. */}
      {atDue ? (
        <View style={[styles.reminder, styles.atDue]}>
          <Icon name="bell" />
          <Text style={styles.atDueText}>At due</Text>
          <Text style={styles.atDueHint}>From the due time</Text>
        </View>
      ) : null}
      {sorted.length === 0 && !atDue ? (
        <Text style={styles.empty}>No alerts yet.</Text>
      ) : null}
      {sorted.map((at) => (
        <View key={at} style={styles.reminder}>
          <Icon name="bell" />
          <Text style={styles.reminderText}>{whenWords(at, today)}</Text>
          <IconButton
            label={`remove reminder ${whenWords(at, today)}`}
            onPress={() => remove(at)}
          >
            <Icon name="close" />
          </IconButton>
        </View>
      ))}
      {adding ? (
        <View style={styles.addFlow}>
          <DateGrid
            picked={day}
            today={today}
            month={month}
            onMonth={setMonth}
            onPick={setDay}
          />
          <TimeFace clock={clock} onChange={setClock} />
          <View style={styles.footer}>
            <Button
              variant="text"
              tone="muted"
              label="Cancel"
              accessibilityLabel="cancel the reminder"
              onPress={() => setAdding(false)}
            />
            <View style={styles.spacer} />
            <Button
              label="Add reminder"
              accessibilityLabel="save reminder"
              onPress={add}
            />
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
          onPress={() => {
            const start = dayOf(due) ?? startOfDay(today);
            setDay(start);
            setMonth(start);
            setClock(clockOf(due) ?? DEFAULT_CLOCK);
            setAdding(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="add reminder"
        >
          <Icon name="plus" color="accent" size={18} />
          <Text style={styles.addText}>Add reminder</Text>
        </Pressable>
      )}
      {/* The add flow is one task at a time, so the switch waits. */}
      {adding ? null : (
        <View style={styles.alarm}>
          <View style={styles.alarmText}>
            <Text style={styles.alarmLabel}>Alarm</Text>
            <Text style={styles.hint}>
              Sounds an alarm and breaks Do Not Disturb.
            </Text>
          </View>
          <Switch
            checked={weight === "harsh"}
            label="alarm"
            onCheckedChange={(on) => onWeight(on ? "harsh" : "quiet")}
          />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    body: {
      gap: spacing.s,
    },
    empty: {
      ...type.meta,
      color: colors.inkMuted,
    },
    reminder: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      minHeight: touchTarget,
      paddingLeft: spacing.m,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.surface,
    },
    reminderText: {
      flex: 1,
      ...type.body,
      color: colors.ink,
    },
    atDue: {
      paddingRight: spacing.m,
    },
    atDueText: {
      flex: 1,
      ...type.body,
      color: colors.inkMuted,
    },
    atDueHint: {
      ...type.meta,
      color: colors.inkMuted,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      minHeight: touchTarget,
      paddingHorizontal: spacing.m,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderStyle: "dashed",
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    addText: {
      ...type.body,
      fontWeight: "600",
      color: colors.accent,
    },
    addFlow: {
      gap: spacing.m,
      paddingTop: spacing.s,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    spacer: {
      flex: 1,
    },
    alarm: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingTop: spacing.s,
    },
    alarmText: {
      flex: 1,
      gap: spacing.xs,
    },
    alarmLabel: {
      ...type.body,
      fontWeight: "600",
      color: colors.ink,
    },
    hint: {
      ...type.caption,
      color: colors.inkMuted,
    },
  }),
});
