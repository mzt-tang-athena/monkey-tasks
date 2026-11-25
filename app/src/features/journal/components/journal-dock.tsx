import * as React from "react";
import { useIsFocused } from "expo-router";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import type { JournalSlot } from "@/components/bottom-bar/dock-slot";
import {
  AddButton,
  type AddButtonRef,
} from "@/components/bottom-bar/add-button";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { spacing } from "@/theme/tokens";
import { useJournalSheet } from "../hooks/use-journal-sheet";
import { EntryForm } from "./entry-form";

/**
 * The journal dock: the bar's Add button, the sheet it opens, and the
 * toast for a failed write. The sheet and the toast draw
 * in the overlay host, above every screen.
 *
 * It answers no capture request. The command pane's "Add task" means a
 * task, and on this tab it stays inert rather than quietly writing a
 * journal entry.
 */
export function JournalDock({ day, onSend }: JournalSlot) {
  const bar = useBar();
  const focused = useIsFocused();
  const sheet = useJournalSheet({
    day,
    bar,
    focused,
    onSend: () => onSend?.(),
  });

  const addRef = React.useRef<AddButtonRef | null>(null);
  // The overlay outlives `open` by the exit, and the page stays inert
  // until it goes. The button takes focus back only once the sheet
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
      <AddButton ref={addRef} label="add entry" onPress={sheet.toggle} />

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

