import * as React from "react";
import type { BarState } from "@/components/bottom-bar/bottom-bar";
import type { JournalEntryDraft } from "@/lib/journal/format";
import { useProgress, type Progress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { NoteChangedError } from "@/lib/vault/notes";
import { useAppendEntry } from "@/stores/journal/mutations/use-append-entry";
import { failureMessage } from "../lib/labels";
import { useEntryDraft, type EntryDraft } from "./use-entry-draft";

export type JournalSheetState = {
  /** The user's intent: the sheet shows. */
  open: boolean;
  /** The sheet is in the tree. It stays there while its exit plays. */
  mounted: boolean;
  draft: EntryDraft;
  /** The Food chip. It outlives a sent entry, per day. */
  food: boolean;
  toggleFood: () => void;
  /** 0 closed to 1 open. The sheet, its scrim and the bar share it. */
  progress: Progress;
  /** The failure toast, or null when there is nothing to report. */
  toast: { message: string; retry: () => void; dismiss: () => void } | null;
  /** The Add button: opens the sheet, or closes it when it is open. */
  toggle: () => void;
  close: () => void;
};

/**
 * The entry sheet's state: open and mounted, the one clock, the draft,
 * the Food chip and the failure toast. The sheet, its scrim and the
 * bar's slide read the same `useProgress` value, so they move as one.
 *
 * Send leaves in one motion: the sheet closes on the same frame the
 * input drops focus, and the block is appended behind it. A failed
 * write raises the toast and keeps the draft. The sheet never reopens
 * for an error.
 */
export function useJournalSheet({
  day,
  bar,
  focused,
  onSend,
}: {
  /** The local day. The chip's choice resets when the day does. */
  day: string;
  bar: BarState;
  /** The tab shows. The sheet belongs to its tab. */
  focused: boolean;
  /** Runs when a send starts, before the write. */
  onSend: () => void;
}): JournalSheetState {
  const append = useAppendEntry(day);

  // The chip keeps the day's last choice. It lives here, above the
  // sheet's mount, so closing and reopening the composer keeps it.
  const [food, setFood] = React.useState(false);
  const [foodDay, setFoodDay] = React.useState(day);
  if (foodDay !== day) {
    setFoodDay(day);
    setFood(false);
  }

  const [failure, setFailure] = React.useState<{ dismissed: boolean } | null>(
    null,
  );

  const write = React.useCallback(
    async (draft: JournalEntryDraft) => {
      onSend();
      try {
        await append(draft);
        setFailure(null);
      } catch (error) {
        setFailure({ dismissed: false });
        throw error;
      }
    },
    [append, onSend],
  );

  const draft = useEntryDraft({
    food,
    onSend: write,
    failure: (error) => ({
      message: failureMessage(error, error instanceof NoteChangedError),
      changed: error instanceof NoteChangedError,
    }),
  });

  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const progress = useProgress(open, {
    ms: motion.ms.sheet,
    onSettled: (at) => at === 0 && setMounted(false),
  });

  // The bar slides away on the sheet's clock, on the UI thread.
  const { setHide } = bar;
  React.useLayoutEffect(() => setHide(progress), [setHide, progress]);

  // The sheet draws above every screen, so it must not outlive its tab.
  if (!focused && mounted) {
    setOpen(false);
    setMounted(false);
  }

  const close = React.useCallback(() => setOpen(false), []);

  const openSheet = () => {
    setFailure(null);
    // Cleared here, not on send, so the closing frame keeps the input's
    // height and the sheet never jumps as it leaves. A failed draft
    // stays, because it is the one Retry writes.
    if (draft.error == null) {
      draft.reset();
    }
    setMounted(true);
    setOpen(true);
  };

  const toast =
    failure != null && !failure.dismissed && draft.error != null
      ? {
          message: draft.error.message,
          // The hook still holds the draft that failed, so Retry writes
          // what the operator sent, at the minute they sent it.
          retry: () => draft.retry(),
          dismiss: () =>
            setFailure((current) =>
              current == null ? null : { dismissed: true },
            ),
        }
      : null;

  return {
    open,
    mounted,
    draft,
    food,
    toggleFood: () => setFood((on) => !on),
    progress,
    toast,
    toggle: () => (open ? close() : openSheet()),
    close,
  };
}
