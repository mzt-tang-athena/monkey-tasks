import * as React from "react";
import type { BarState } from "@/components/bottom-bar/bottom-bar";
import type { NoteDraft } from "@/lib/inbox-notes/model";
import { useProgress, type Progress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { useCreateNote } from "@/stores/inbox-notes/mutations/use-create-note";

export type NoteSheetState = {
  /** The user's intent: the sheet shows. */
  open: boolean;
  /** The sheet is in the tree. It stays there while its exit plays. */
  mounted: boolean;
  title: string;
  body: string;
  /** The optional title field is revealed. */
  titleOpen: boolean;
  setTitle: (title: string) => void;
  setBody: (body: string) => void;
  revealTitle: () => void;
  canSend: boolean;
  sending: boolean;
  /** 0 closed to 1 open. The sheet, its scrim and the bar share it. */
  progress: Progress;
  /** The failure toast, or null when there is nothing to report. */
  toast: { message: string; retry: () => void; dismiss: () => void } | null;
  /** The Add button: opens the sheet, or closes it when it is open. */
  toggle: () => void;
  close: () => void;
  send: () => void;
};

/**
 * The note sheet's state: open and mounted, the one clock, the draft
 * and the failure toast.
 *
 * The body takes the focus and the title stays behind a quiet reveal,
 * so the fast path is a body and no title. Send leaves in one motion:
 * the sheet closes on the same frame the keyboard drops, and the file
 * is written behind it. A failed write raises the toast and keeps the
 * exact draft for Retry.
 */
export function useNoteSheet({
  bar,
  focused,
}: {
  bar: BarState;
  /** The tab shows. The sheet belongs to its tab. */
  focused: boolean;
}): NoteSheetState {
  const create = useCreateNote();

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [titleOpen, setTitleOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [failure, setFailure] = React.useState<{
    message: string;
    draft: NoteDraft;
  } | null>(null);

  const [open, setOpenState] = React.useState(false);
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
    setOpenState(false);
    setMounted(false);
  }

  const close = React.useCallback(() => setOpenState(false), []);

  const write = React.useCallback(
    async (draft: NoteDraft) => {
      setSending(true);
      setFailure(null);
      try {
        await create(draft);
        setTitle("");
        setBody("");
        setTitleOpen(false);
      } catch (error) {
        setFailure({
          message: error instanceof Error ? error.message : String(error),
          draft,
        });
      } finally {
        setSending(false);
      }
    },
    [create],
  );

  const canSend =
    !sending && (body.trim() !== "" || title.trim() !== "");

  const send = React.useCallback(() => {
    if (!canSend) {
      return;
    }
    const draft = { title: title.trim(), body };
    close();
    void write(draft);
  }, [body, canSend, close, title, write]);

  const openSheet = () => {
    if (failure != null) {
      setTitle(failure.draft.title);
      setBody(failure.draft.body);
      setTitleOpen(failure.draft.title !== "");
      setFailure(null);
    }
    setMounted(true);
    setOpenState(true);
  };

  const toast =
    failure == null
      ? null
      : {
          message: failure.message,
          retry: () => {
            if (!sending) {
              void write(failure.draft);
            }
          },
          dismiss: () => setFailure(null),
        };

  return {
    open,
    mounted,
    title,
    body,
    titleOpen,
    setTitle,
    setBody,
    revealTitle: () => setTitleOpen(true),
    canSend,
    sending,
    progress,
    toast,
    toggle: () => (open ? close() : openSheet()),
    close,
    send,
  };
}
