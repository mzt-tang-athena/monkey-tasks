import * as React from "react";
import { buildEntry, type JournalEntryDraft } from "@/lib/journal/format";

export type EntryDraft = {
  text: string;
  setText: (next: string) => void;
  /** True when a send would write at least one bullet. */
  canSend: boolean;
  sending: boolean;
  /** The last failure, ready to show. Null otherwise. */
  error: { message: string; changed: boolean } | null;
  /** Build one entry and write it. */
  send: () => void;
  /** Write the same block again, at the minute it was first sent. */
  retry: () => void;
  /** Clear everything, for a fresh sheet. */
  reset: () => void;
};

/**
 * The entry composer's state. A send builds one draft and keeps it, so
 * a retry writes the entry the operator meant at the minute they meant
 * it, not a fresh one ten minutes later.
 *
 * A failed write keeps the text and the draft, and reports its
 * message. The latch stops a second send while one runs.
 */
export function useEntryDraft({
  food,
  onSend,
  failure,
}: {
  /** The Food chip. It changes the bytes, not the draft's identity. */
  food: boolean;
  onSend: (draft: JournalEntryDraft) => Promise<void>;
  /** Turns a rejection into the words the toast shows. */
  failure: (error: unknown) => { message: string; changed: boolean };
}): EntryDraft {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<EntryDraft["error"]>(null);
  const [pending, setPending] = React.useState<JournalEntryDraft | null>(null);

  const write = React.useCallback(
    (draft: JournalEntryDraft) => {
      setSending(true);
      setError(null);
      void onSend(draft).then(
        () => {
          setText("");
          setPending(null);
          setSending(false);
        },
        (reason: unknown) => {
          setError(failure(reason));
          setSending(false);
        },
      );
    },
    [failure, onSend],
  );

  const send = React.useCallback(() => {
    if (sending) {
      return;
    }
    const draft = buildEntry({ text, food, at: new Date() });
    if (draft == null) {
      return;
    }
    setPending(draft);
    write(draft);
  }, [food, sending, text, write]);

  const retry = React.useCallback(() => {
    if (pending != null && !sending) {
      write({ ...pending, retry: true });
    }
  }, [pending, sending, write]);

  const reset = React.useCallback(() => {
    setText("");
    setError(null);
    setPending(null);
  }, []);

  return {
    text,
    setText,
    canSend: text.trim() !== "" && !sending,
    sending,
    error,
    send,
    retry,
    reset,
  };
}
