import * as React from "react";
import { parseCapture, type ParsedCapture } from "../parse";
import type { CaptureTarget } from "../write";

export type CaptureDraft = {
  text: string;
  setText: (next: string) => void;
  parsed: ParsedCapture | null;
  targets: CaptureTarget[];
  target: CaptureTarget;
  cycleTarget: () => void;
  canSend: boolean;
  sending: boolean;
  error: string | null;
  send: () => void;
  reset: () => void;
};

/**
 * The capture draft and its send lifecycle. The text, the target pill
 * and the write behind a send live here so the sheet only renders
 * them. A send is latched while its write is in flight: the latch
 * stops a second tap on the same draft, it never greys the arrow for
 * the write. A failure keeps the draft and reports it; a successful
 * send clears it.
 */
export function useCaptureDraft({
  targets,
  defaultTargetIndex,
  onSend,
}: {
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  onSend: (
    parsed: ParsedCapture,
    target: CaptureTarget,
  ) => void | Promise<void>;
}): CaptureDraft {
  const [text, setText] = React.useState("");
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The target pill follows the screen's list tab. The bar itself
  // never remounts, so switching tabs does not make it jump.
  const [lastDefault, setLastDefault] = React.useState(defaultTargetIndex);
  if (lastDefault !== defaultTargetIndex) {
    setLastDefault(defaultTargetIndex);
    setTargetIndex(defaultTargetIndex);
  }

  // The chips follow the text; parsing is the one expensive step in
  // this sheet, so it is memoized.
  const parsed = React.useMemo(
    () => (text.trim() ? parseCapture(text) : null),
    [text],
  );
  const canSend = text.trim() !== "" && !sending;

  const send = () => {
    // The latch only stops a second tap on the same draft.
    if (sending || text.trim() === "") {
      return;
    }
    const capture = parseCapture(text);
    if (capture == null) {
      return;
    }
    const target = targets[targetIndex] ?? targets[0];
    setSending(true);
    let write: void | Promise<void>;
    try {
      write = onSend(capture, target);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setSending(false);
      return;
    }
    void Promise.resolve(write).then(
      () => {
        setText("");
        setSending(false);
      },
      (failure: unknown) => {
        setError(failure instanceof Error ? failure.message : String(failure));
        setSending(false);
      },
    );
  };

  const reset = () => {
    setText("");
    setError(null);
  };

  const cycleTarget = () => {
    setTargetIndex((index) => (index + 1) % targets.length);
  };

  return {
    text,
    setText,
    parsed,
    targets,
    target: targets[targetIndex] ?? targets[0],
    cycleTarget,
    canSend,
    sending,
    error,
    send,
    reset,
  };
}
