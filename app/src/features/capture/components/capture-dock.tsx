import * as React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import type { CaptureSlot } from "@/components/bottom-bar/dock-slot";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { useCaptureSheet } from "@/features/capture/hooks/use-capture-sheet";
import { bottomBar, colors, fonts, radii, spacing } from "@/theme/tokens";
import { CaptureForm } from "./capture-form";

/**
 * The capture dock: the Add button in the bottom bar's action slot,
 * the sheet it opens, and the toast for a failed write. The sheet and
 * the toast draw in the overlay host, above every screen. The screen
 * tells the dock its targets, its default target and its default due
 * day, and the dock sends through the capture mutation.
 */
export function CaptureDock(slot: CaptureSlot) {
  const bar = useBar();
  const sheet = useCaptureSheet({ ...slot, bar });

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
        onPress={sheet.toggle}
        accessibilityRole="button"
        accessibilityLabel="add task"
      >
        <Icon name="plus" color="onAccent" />
        <Text style={styles.addLabel}>Add</Text>
      </Pressable>

      {/* The sheet stays mounted while its exit plays, and the scrim
          follows the bar's collapse. */}
      {sheet.mounted ? (
        <Sheet
          open={sheet.open}
          onClose={sheet.close}
          label="Add a task"
          closeLabel="close capture"
          progress={sheet.expand}
          bottom={sheet.dockBottom}
          scrim={sheet.scrim}
        >
          <CaptureForm draft={sheet.draft} onClose={sheet.close} />
        </Sheet>
      ) : null}

      {/* A failed write reports above the bar, with the draft kept for
          Retry. The sheet stays closed: the toast takes its place, and
          opening the sheet again clears the toast. */}
      {sheet.toast != null ? (
        <Toast
          message={sheet.toast.message}
          bottom={bar.height + spacing.s}
          actions={[
            {
              label: "Retry",
              accessibilityLabel: "retry capture",
              onPress: sheet.toast.retry,
            },
            {
              label: "Dismiss",
              accessibilityLabel: "dismiss capture failure",
              onPress: sheet.toast.dismiss,
            },
          ]}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // An unmistakable button: glyph and label optically centered on one
  // line.
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: bottomBar.add,
    paddingHorizontal: spacing.l,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  addPressed: {
    backgroundColor: colors.accentDeep,
  },
  addLabel: {
    color: colors.onAccent,
    fontSize: bottomBar.addLabelSize,
    lineHeight: bottomBar.addLabelLine,
    fontFamily: fonts.body,
    fontWeight: "600",
  },
});
