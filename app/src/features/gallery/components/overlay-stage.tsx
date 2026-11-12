import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { CommandPane, type CommandRow } from "@/components/ui/command-pane";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { Toast } from "@/components/ui/toast";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The four surfaces that draw above the page through the overlay host. */
export type OverlayName = "menu" | "sheet" | "command-pane" | "toast";

/**
 * Opens one overlay at a time. A modal overlay makes the page behind it
 * inert, so the gallery offers them one at a time and the spec closes
 * each before it scans the next.
 */
export function OverlayStage({
  open,
  anchor,
  onClose,
}: {
  open: OverlayName | null;
  anchor: React.RefObject<React.ComponentRef<typeof View> | null>;
  onClose: () => void;
}) {
  if (open === "menu") {
    return (
      <Menu
        open
        anchor={anchor}
        label="Row actions"
        onClose={onClose}
        items={menuItems(onClose)}
      />
    );
  }
  if (open === "sheet") {
    return <SheetDemo onClose={onClose} />;
  }
  if (open === "command-pane") {
    return (
      <CommandPane
        open
        label="Commands"
        commands={commands(onClose)}
        onClose={onClose}
      />
    );
  }
  if (open === "toast") {
    return (
      <Toast
        message="Could not save the task"
        bottom={spacing.xl}
        actions={[
          { label: "Retry", onPress: onClose },
          { label: "Dismiss", onPress: onClose },
        ]}
      />
    );
  }
  return null;
}

function menuItems(onClose: () => void): MenuItem[] {
  return [
    { key: "open", label: "Open task", onPress: onClose },
    { key: "move", label: "Move to list", onPress: onClose },
    { key: "done", label: "Mark done", selected: true, onPress: onClose },
    { key: "delete", label: "Delete task", tone: "danger", onPress: onClose },
  ];
}

function commands(onClose: () => void): CommandRow[] {
  return [
    { id: "settings", label: "Settings", hint: "App", onPress: onClose },
    { id: "planner", label: "Open planner", hint: "Week", onPress: onClose },
    { id: "lists", label: "Open lists", hint: "Main", onPress: onClose },
  ];
}

/** The sheet takes its clock from the caller, and this one opens at once. */
function SheetDemo({ onClose }: { onClose: () => void }) {
  const { styles } = useThemedStyles(makeStyles);
  const progress = useProgress(true, { ms: motion.ms.sheet });
  return (
    <Sheet
      open
      label="Add a task"
      closeLabel="close sheet"
      progress={progress}
      onDismiss={onClose}
      scrim
    >
      <Text style={styles.title}>Add a task</Text>
      <TextField label="Name" defaultValue="Buy milk" />
      <View style={styles.actions}>
        <Button label="Save" onPress={onClose} />
        <Button variant="text" tone="muted" label="Cancel" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    title: {
      ...type.title,
      color: colors.ink,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.m,
    },
  }),
});
