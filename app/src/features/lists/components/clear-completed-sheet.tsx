import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import type { TaskItem } from "@/types/task";
import { spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * The confirmation for Delete all completed tasks. It names how many
 * notes the tab loses and keeps Cancel as the safe default: Cancel
 * holds the first focus, and Escape or Android back dismiss the sheet.
 * The parent owns the tasks and the lifetime, so the sheet keeps its
 * count while its exit plays.
 */
export function ClearCompletedSheet({
  open,
  tasks,
  onCancel,
  onConfirm,
  onExited,
}: {
  open: boolean;
  /** The notes the confirm deletes, fixed when the menu item opened it. */
  tasks: readonly TaskItem[];
  onCancel: () => void;
  onConfirm: (tasks: readonly TaskItem[]) => void;
  /** The exit finished, so the parent can drop the sheet. */
  onExited: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const progress = useProgress(open, {
    ms: motion.ms.sheet,
    onSettled: (at) => {
      if (at === 0) {
        onExited();
      }
    },
  });
  const count = tasks.length;
  return (
    <Sheet
      open={open}
      onDismiss={onCancel}
      label="Delete completed tasks"
      closeLabel="close delete sheet"
      progress={progress}
      scrim
    >
      <Text accessibilityRole="header" style={styles.title}>
        {count === 1
          ? "Delete 1 completed task?"
          : `Delete ${count} completed tasks?`}
      </Text>
      <Text style={styles.body}>
        {count === 1
          ? "This removes its note from the vault."
          : "This removes their notes from the vault."}
      </Text>
      <View style={styles.actions}>
        <Button variant="text" tone="muted" label="Cancel" onPress={onCancel} />
        <Button
          variant="text"
          tone="danger"
          label="Delete"
          onPress={() => onConfirm(tasks)}
        />
      </View>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    title: {
      ...type.control,
      color: colors.ink,
      fontWeight: "600",
    },
    body: {
      ...type.meta,
      color: colors.inkMuted,
    },
    // Cancel sits first, so the sheet's focus lands on the safe action.
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.s,
    },
  }),
});
