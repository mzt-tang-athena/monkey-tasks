import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SheetGrab } from "@/components/motion/sheet-drag";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import type { Progress } from "@/lib/motion/progress";
import { RESCHEDULE_CHOICES } from "@/lib/alerts/choices";
import {
  clearSnoozeRequest,
  useSnoozeRequest,
  type SnoozeRequest,
} from "@/lib/alerts/snooze-request";
import { openTask } from "@/lib/task-route";
import { defaultAdapter } from "@/lib/vault/default-adapter";
import { useSheetClock } from "@/hooks/use-sheet-clock";
import { performAlertPress } from "@/stores/tasks/alert-actions";
import { TASKS_KEY } from "@/stores/tasks/query";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * The sheet behind a reminder's Snooze button: Later, Tomorrow, and
 * Pick a day. Later and Tomorrow write through the same press as the
 * old buttons did, so the times and the failure notice stay the same
 * (ADR 20261125-reminder-actions). Pick a day opens the task's Due
 * picker and leaves the reminder up until a date is saved. Closing the
 * sheet changes nothing, so the reminder stays.
 */
export function SnoozeHost() {
  const request = useSnoozeRequest();
  // The sheet keeps the last request while its exit plays.
  const [shown, setShown] = React.useState(request);
  if (request != null && request !== shown) {
    setShown(request);
  }
  const { mounted, progress } = useSheetClock(request != null);
  if (!mounted || shown == null) {
    return null;
  }
  return <SnoozeSheet open={request != null} progress={progress} request={shown} />;
}

function SnoozeSheet({
  open,
  progress,
  request,
}: {
  open: boolean;
  progress: Progress;
  request: SnoozeRequest;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const client = useQueryClient();

  const choose = (id: string, target: string) => {
    clearSnoozeRequest();
    void performAlertPress(defaultAdapter(), {
      uri: request.uri,
      base: request.base,
      action: { kind: "reschedule", target },
      name: request.name,
      key: `${request.key}|${id}`,
    }).then(() => client.invalidateQueries({ queryKey: [TASKS_KEY] }));
  };

  const pickDay = () => {
    clearSnoozeRequest();
    openTask(request.uri, { picker: "due" });
  };

  return (
    <Sheet
      open={open}
      onDismiss={clearSnoozeRequest}
      progress={progress}
      scrim
      label="Snooze"
      closeLabel="close snooze"
    >
      <SheetGrab>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Snooze
          </Text>
        </View>
      </SheetGrab>
      <Text numberOfLines={1} style={styles.name}>
        {request.name}
      </Text>
      <View style={styles.rows}>
        {RESCHEDULE_CHOICES.map((choice) => (
          <Row
            key={choice.id}
            label={choice.title}
            onPress={() => choose(choice.id, choice.target(new Date()))}
          />
        ))}
        <Row label="Pick a day" onPress={pickDay} />
      </View>
    </Sheet>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
    },
    title: {
      flex: 1,
      ...type.title,
      color: colors.ink,
    },
    name: {
      ...type.meta,
      color: colors.inkMuted,
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
      gap: spacing.m,
      minHeight: 48,
      paddingHorizontal: spacing.m,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    rowText: {
      flex: 1,
      ...type.body,
      color: colors.ink,
    },
  }),
});
