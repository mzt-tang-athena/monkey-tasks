import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TaskStatus } from "@monkey-tasks/schemas";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { statusWords } from "../model";

/** The five statuses, in the board's group order. */
export const STATUS_CHOICES: readonly TaskStatus[] = [
  "[[active]]",
  "[[backlog]]",
  "[[someday]]",
  "[[dropped]]",
  "[[done]]",
];

/**
 * The Status picker: one row per status. A row asks its caller, so the
 * editor can send Done through the tick's completion path, which keeps
 * `completed` and the next occurrence in step.
 */
export function StatusPicker({
  current,
  onPick,
  onClose,
}: {
  current: TaskStatus | null;
  onPick: (status: TaskStatus) => void;
  onClose: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.body}>
      <View style={styles.rows}>
        {STATUS_CHOICES.map((status) => {
          const chosen = current === status;
          return (
            <Pressable
              key={status}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                onPick(status);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={statusWords(status)}
              aria-pressed={chosen}
            >
              <Text style={[styles.name, chosen && styles.nameChosen]}>
                {statusWords(status)}
              </Text>
              {chosen ? <Icon name="check" color="accent" /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Done marks the deed complete. The other statuses keep it open.
      </Text>
    </View>
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
      gap: spacing.m,
      minHeight: 48,
      paddingHorizontal: spacing.m,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    name: {
      flex: 1,
      ...type.body,
      color: colors.ink,
    },
    nameChosen: {
      fontWeight: "600",
      color: colors.accent,
    },
    hint: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
