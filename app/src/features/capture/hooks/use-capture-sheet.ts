import * as React from "react";
import type { BarState } from "@/components/bottom-bar/bottom-bar";
import { useProgress, type Progress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { useCaptureTask } from "@/stores/tasks/mutations/use-capture-task";
import type { CaptureTarget, ParsedCapture } from "@/types/task";
import { useCaptureDraft, type CaptureDraft } from "./use-capture-draft";

export type CaptureSheetState = {
  /** The user's intent: the sheet shows. */
  open: boolean;
  /** The sheet is in the tree. It stays there while its exit plays. */
  mounted: boolean;
  draft: CaptureDraft;
  /** 0 closed to 1 open. The sheet, its scrim and the bar share it. */
  progress: Progress;
  /** The failure toast, or null when there is nothing to report. */
  toast: { message: string; retry: () => void; dismiss: () => void } | null;
  /** The Add button: opens the sheet, or closes it when it is open. */
  toggle: () => void;
  close: () => void;
};

/**
 * The capture sheet's state: open and mounted, the one clock, the
 * draft, and the failure toast. The sheet, its scrim and the bar's
 * slide all read the same `useProgress` value, so they move as one.
 *
 * Saving leaves in one motion: the sheet closes on the same frame the
 * input drops focus, and the note is written behind it. A failed write
 * raises the toast and keeps the draft. The sheet itself never reopens
 * for an error.
 */
export function useCaptureSheet({
  targets,
  defaultTargetIndex,
  dueDay,
  bar,
  focused,
}: {
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  dueDay?: string;
  bar: BarState;
  /** The tab shows. The sheet belongs to its tab. */
  focused: boolean;
}): CaptureSheetState {
  const capture = useCaptureTask();

  // The failure the user has not dismissed, or null. The message and
  // the draft itself live in the draft hook. This only carries the
  // toast, so Retry repeats the draft the hook still holds.
  const [failure, setFailure] = React.useState<{ dismissed: boolean } | null>(
    null,
  );

  // The write behind a send, run after the sheet is already on its way
  // out. A failure raises the toast and keeps the draft for Retry. A
  // success clears the toast.
  const write = React.useCallback(
    async (parsed: ParsedCapture, target: CaptureTarget) => {
      try {
        await capture(parsed, target, dueDay);
        setFailure(null);
      } catch (error) {
        setFailure({ dismissed: false });
        throw error;
      }
    },
    [capture, dueDay],
  );

  const draft = useCaptureDraft({
    targets,
    defaultTargetIndex,
    onSend: write,
  });

  // Open is the user's intent. Mounted keeps the sheet on screen while
  // the exit animation plays. The clock runs to closed with no view
  // after a focus close, so the bar still ends shown.
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const progress = useProgress(open, {
    ms: motion.ms.sheet,
    onSettled: (at) => at === 0 && setMounted(false),
  });

  // The bar slides away on the sheet's clock. It reads the value in its
  // own animated style, so a frame never renders the bar.
  const { setHide } = bar;
  React.useLayoutEffect(() => setHide(progress), [setHide, progress]);

  // The sheet draws above every screen, so it must not outlive its tab.
  // When another screen takes focus, from a nav tab or a row, the sheet
  // leaves at once with no exit to play. It closes during the render
  // that sees the focus go, so no frame draws it over the next screen.
  if (!focused && mounted) {
    setOpen(false);
    setMounted(false);
  }

  const close = React.useCallback(() => setOpen(false), []);

  const openSheet = () => {
    setFailure(null);
    // The sent draft is cleared here, not on send, so the closing frame
    // keeps the input's height and the sheet never jumps as it leaves.
    draft.reset();
    setMounted(true);
    setOpen(true);
  };

  const toast =
    failure != null && !failure.dismissed && draft.error != null
      ? {
          message: draft.error,
          // The hook still holds the draft that failed, so a retry
          // repeats what the user sent, not what the input holds now.
          retry: () => {
            if (!draft.sending) {
              draft.send();
            }
          },
          dismiss: () =>
            setFailure((current) => (current == null ? null : { dismissed: true })),
        }
      : null;

  return {
    open,
    mounted,
    draft,
    progress,
    toast,
    toggle: () => (open ? close() : openSheet()),
    close,
  };
}
