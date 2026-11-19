import * as React from "react";
import { useIsFocused } from "expo-router";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import type { CaptureSlot } from "@/components/bottom-bar/dock-slot";
import {
  SplitAddPill,
  type SplitAddPillRef,
} from "@/components/bottom-bar/split-add-pill";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { useCaptureRequest } from "@/lib/capture-request";
import { useTaskEditor } from "@/hooks/use-task-editor";
import { useCaptureSheet } from "@/features/capture/hooks/use-capture-sheet";
import { spacing } from "@/theme/tokens";
import { CaptureForm } from "./capture-form";

/**
 * The capture dock: the bar's split Add pill, the sheet its Add half
 * opens, and the toast for a failed write. The sheet and the toast draw
 * in the overlay host, above every screen. The screen tells the dock its
 * targets, its default target and its default due day, and the dock
 * sends through the capture mutation.
 */
export function CaptureDock(slot: CaptureSlot) {
  const bar = useBar();
  const focused = useIsFocused();
  // The editor sheet draws over this tab, and its own toast would land
  // on the sheet's edge. The capture toast waits until the sheet goes.
  const { showing } = useTaskEditor();
  const sheet = useCaptureSheet({ ...slot, bar, focused });
  // The command pane's Add task reaches the dock on the focused tab.
  useCaptureRequest(() => {
    if (focused) {
      sheet.show();
    }
  });
  const addRef = React.useRef<SplitAddPillRef | null>(null);
  // The sheet's overlay outlives its `open` prop by the exit, and the
  // page stays inert until it goes. The Add half takes focus back only
  // once the sheet has left the tree.
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
      <SplitAddPill ref={addRef} label="add task" onPress={sheet.toggle} />

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
      {sheet.toast != null && focused && !showing ? (
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
