import * as React from "react";
import { useIsFocused } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import type { CaptureSlot } from "@/components/bottom-bar/dock-slot";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
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
  const focused = useIsFocused();
  const sheet = useCaptureSheet({ ...slot, bar, focused });
  const addRef = React.useRef<React.ComponentRef<typeof Pressable>>(null);
  // The sheet's overlay outlives its `open` prop by the exit, and the
  // page stays inert until it goes. The Add button takes focus back
  // only once the sheet has left the tree.
  const wasMounted = React.useRef(false);
  React.useEffect(() => {
    if (sheet.mounted) {
      wasMounted.current = true;
      return;
    }
    if (wasMounted.current) {
      wasMounted.current = false;
      (addRef.current as unknown as HTMLElement | null)?.focus?.();
    }
  }, [sheet.mounted]);

  return (
    <>
      <Pressable
        ref={addRef}
        style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
        onPress={sheet.toggle}
        accessibilityRole="button"
        accessibilityLabel="add task"
      >
        <Icon name="plus" color="onAccent" />
        <Text style={styles.addLabel}>Add</Text>
      </Pressable>

      {sheet.mounted ? (
        <Sheet
          open={sheet.open}
          progress={sheet.progress}
          onDismiss={sheet.close}
          rideKeyboard
          scrim
          label="Add a task"
          closeLabel="close capture"
        >
          <CaptureForm draft={sheet.draft} onClose={sheet.close} />
        </Sheet>
      ) : null}

      {/* A failed write reports above the bar, with the draft kept for
          Retry. The sheet stays closed: the toast takes its place, and
          opening the sheet again clears the toast. */}
      {/* The toast belongs to its tab. The overlay host sits above the
          whole stack, so a tab that is not focused draws nothing: the
          editor and the other tab stay clear. */}
      {sheet.toast != null && focused ? (
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
