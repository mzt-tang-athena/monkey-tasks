import * as React from "react";
import { useIsFocused } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import type { JournalSlot } from "@/components/bottom-bar/dock-slot";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { bottomBar, fonts, radii, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { useJournalSheet } from "../hooks/use-journal-sheet";
import { EntryForm } from "./entry-form";

/**
 * The journal dock: the Add button in the bottom bar's action slot, the
 * sheet it opens, and the toast for a failed write. The sheet and the
 * toast draw in the overlay host, above every screen.
 *
 * It answers no capture request. The command pane's "Add task" means a
 * task, and on this tab it stays inert rather than quietly writing a
 * journal entry.
 */
export function JournalDock({ day, onSend }: JournalSlot) {
  const { styles } = useThemedStyles(makeStyles);
  const bar = useBar();
  const focused = useIsFocused();
  const sheet = useJournalSheet({
    day,
    bar,
    focused,
    onSend: () => onSend?.(),
  });

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
        accessibilityLabel="add entry"
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
          label="Write an entry"
          closeLabel="close entry"
        >
          <EntryForm
            draft={sheet.draft}
            food={sheet.food}
            onToggleFood={sheet.toggleFood}
            onClose={sheet.close}
          />
        </Sheet>
      ) : null}

      {/* A failed write reports above the bar, with the draft kept for
          Retry. The sheet stays closed: the toast takes its place, and
          opening the sheet again clears the toast. The toast belongs to
          its tab, so an unfocused tab draws nothing. */}
      {sheet.toast != null && focused ? (
        <Toast
          message={sheet.toast.message}
          bottom={bar.height + spacing.s}
          actions={[
            {
              label: "Retry",
              accessibilityLabel: "retry entry",
              onPress: sheet.toast.retry,
            },
            {
              label: "Dismiss",
              accessibilityLabel: "dismiss entry failure",
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
    // The same unmistakable button the capture dock draws. A
    // presentational control is copied, not shared, so the journal's
    // Add can change on its own (ADR 0022).
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
