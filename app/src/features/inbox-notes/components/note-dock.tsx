import * as React from "react";
import { useIsFocused } from "expo-router";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import {
  SplitAddPill,
  type SplitAddPillRef,
} from "@/components/bottom-bar/split-add-pill";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { spacing } from "@/theme/tokens";
import { useNoteSheet } from "../hooks/use-note-sheet";
import { NoteForm } from "./note-form";

/**
 * The Inbox dock: the bar's split Add pill, the sheet its Add half
 * opens, and the toast for a failed write. The sheet and the toast draw
 * in the overlay host, above every screen.
 */
export function NoteDock() {
  const bar = useBar();
  const focused = useIsFocused();
  const sheet = useNoteSheet({ bar, focused });

  const addRef = React.useRef<SplitAddPillRef | null>(null);
  // The overlay outlives `open` by the exit, and the page stays inert
  // until it goes. The Add half takes focus back only once the sheet
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
      <SplitAddPill ref={addRef} label="add note" onPress={sheet.toggle} />

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

