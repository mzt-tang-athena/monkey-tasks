import * as React from "react";
import { useIsFocused } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { bottomBar, fonts, radii, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { useNoteSheet } from "../hooks/use-note-sheet";
import { NoteForm } from "./note-form";

/**
 * The Inbox dock: the Add button in the bottom bar's action slot, the
 * sheet it opens, and the toast for a failed write. The sheet and the
 * toast draw in the overlay host, above every screen.
 */
export function NoteDock() {
  const { styles } = useThemedStyles(makeStyles);
  const bar = useBar();
  const focused = useIsFocused();
  const sheet = useNoteSheet({ bar, focused });

  const addRef = React.useRef<React.ComponentRef<typeof Pressable>>(null);
  // The overlay outlives `open` by the exit, and the page stays inert
  // until it goes. The Add button takes focus back only once the sheet
  // has left the tree.
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
        accessibilityLabel="add note"
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
          label="New note"
          closeLabel="close note capture"
        >
          <NoteForm sheet={sheet} />
        </Sheet>
      ) : null}

      {/* A failed write reports above the bar, with the draft kept for
          Retry. The sheet stays closed: the toast takes its place, and
          opening the sheet again seeds the draft. */}
      {sheet.toast != null && focused ? (
        <Toast
          message={sheet.toast.message}
          bottom={bar.height + spacing.s}
          actions={[
            {
              label: "Retry",
              accessibilityLabel: "retry note capture",
              onPress: sheet.toast.retry,
            },
            {
              label: "Dismiss",
              accessibilityLabel: "dismiss note failure",
              onPress: sheet.toast.dismiss,
            },
          ]}
        />
      ) : null}
    </>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The same unmistakable button the other docks draw. A
    // presentational control is copied, not shared (ADR 0022).
    add: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
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
  }),
});
