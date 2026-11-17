import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { TextField } from "@/components/ui/text-field";
import { nextAfter, ruleWords, upcoming } from "@/lib/recurrence";
import { addDays, isoOf } from "@/utils/dates";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { whenWords } from "../lib/when";

/** The presets, in the order the picker lists them. */
export const PRESETS: readonly { rule: string; label: string; hint?: string }[] = [
  { rule: "FREQ=DAILY", label: "Daily" },
  { rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Weekdays", hint: "Monday to Friday" },
  { rule: "FREQ=WEEKLY", label: "Weekly" },
  { rule: "FREQ=MONTHLY", label: "Monthly" },
  { rule: "FREQ=YEARLY", label: "Yearly" },
];

/**
 * The due a repeat starts from when the task has none: the rule's first
 * occurrence from today on. A repeat needs a day to count from, and a
 * weekday rule that skips today starts on its next day.
 */
export function startFor(rule: string, today: Date): string {
  const first = nextAfter(rule, isoOf(addDays(today, -1)));
  return first ?? isoOf(today);
}

/**
 * The Repeat picker: the presets, no repeat, and the advanced field.
 * A preset writes at once. Advanced takes an RRULE, shows its next
 * three dates in words, and says when the app cannot read it.
 */
export function RepeatPicker({
  recurrence,
  due,
  today,
  onPick,
  onClose,
}: {
  recurrence: string | null;
  due: string | null;
  today: Date;
  /** The rule and the due it starts from, when the task had none. */
  onPick: (recurrence: string, due: string | null) => void;
  onClose: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [advanced, setAdvanced] = React.useState(
    () => recurrence != null && !PRESETS.some((preset) => preset.rule === recurrence),
  );
  const [rule, setRule] = React.useState(recurrence ?? "");
  const dates = React.useMemo(
    () => (due == null ? null : upcoming(rule, due, 3)),
    [rule, due],
  );
  const words = ruleWords(rule, due);

  const pick = (next: string) => {
    onPick(next, due ?? startFor(next, today));
    onClose();
  };

  return (
    <View style={styles.body}>
      <View style={styles.rows}>
        {PRESETS.map((preset) => {
          const chosen = recurrence === preset.rule;
          const plain = ruleWords(preset.rule, due) ?? preset.label;
          return (
            <ChoiceRow
              key={preset.rule}
              label={preset.label}
              hint={plain === preset.label ? preset.hint : plain}
              chosen={chosen}
              onPress={() => pick(preset.rule)}
            />
          );
        })}
        <ChoiceRow
          label="Advanced"
          hint="Write a repeat rule"
          chosen={advanced}
          onPress={() => setAdvanced(true)}
        />
        <ChoiceRow
          label="Don't repeat"
          hint="Happens once"
          chosen={recurrence == null && !advanced}
          onPress={() => {
            onPick("", due);
            onClose();
          }}
        />
      </View>
      {advanced ? (
        <View style={styles.advanced}>
          <TextField
            label="Repeat rule"
            value={rule}
            onChangeText={setRule}
            placeholder="FREQ=WEEKLY;INTERVAL=2"
            autoCapitalize="characters"
            autoCorrect={false}
            hint="The iCalendar rule, such as FREQ=MONTHLY;BYMONTHDAY=1."
            error={words == null ? "The app cannot read this rule." : null}
          />
          {words == null || dates == null ? null : (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>{words}</Text>
              <Text style={styles.previewDates}>
                {dates.map((at) => whenWords(at, today)).join(" · ")}
              </Text>
            </View>
          )}
          <Button
            label="Use this rule"
            accessibilityLabel="use this repeat rule"
            onPress={() => pick(rule.trim())}
            disabled={words == null}
          />
        </View>
      ) : null}
    </View>
  );
}

function ChoiceRow({
  label,
  hint,
  chosen,
  onPress,
}: {
  label: string;
  hint?: string;
  chosen: boolean;
  onPress: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint == null ? label : `${label} ${hint}`}
      aria-pressed={chosen}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint == null ? null : <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {chosen ? <Icon name="check" color="accent" /> : null}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    body: {
      gap: spacing.m,
    },
    rows: {
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      minHeight: 48,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      ...type.body,
      color: colors.ink,
    },
    rowHint: {
      ...type.caption,
      color: colors.inkMuted,
    },
    advanced: {
      gap: spacing.m,
    },
    preview: {
      gap: spacing.xs,
    },
    previewTitle: {
      ...type.control,
      fontWeight: "600",
      color: colors.ink,
    },
    previewDates: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
