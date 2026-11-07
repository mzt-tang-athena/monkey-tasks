import * as React from "react";
import { Animated, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BarState } from "@/components/bottom-bar/bottom-bar";
import { useCaptureTask } from "@/stores/tasks/mutations/use-capture-task";
import { spacing } from "@/theme/tokens";
import type { CaptureTarget, ParsedCapture } from "@/types/task";
import { useCaptureDraft, type CaptureDraft } from "./use-capture-draft";

/** How long the sheet and the bar take to trade places. */
const travelMs = 220;

export type CaptureSheetState = {
  /** The user's intent: the sheet shows. */
  open: boolean;
  /** The sheet is in the tree. It stays there while its exit plays. */
  mounted: boolean;
  draft: CaptureDraft;
  /** 0 closed to 1 open. The bar's lift runs on the same clock. */
  expand: Animated.Value;
  /** The dock's distance from the bottom of the window. */
  dockBottom: Animated.AnimatedInterpolation<number>;
  /** Where the scrim ends: above the bar, following its collapse. */
  scrim: { bottom: Animated.AnimatedInterpolation<number>; height: number };
  /** The failure toast, or null when there is nothing to report. */
  toast: { message: string; retry: () => void; dismiss: () => void } | null;
  /** The Add button: opens the sheet, or closes it when it is open. */
  toggle: () => void;
  close: () => void;
};

/**
 * The capture sheet's state: open and mounted, the animation clock,
 * the draft, and the failure toast. The sheet and the bar's collapse
 * run on one clock, so they move as a single motion. Ticket 0062 moves
 * that clock; the dock does not change.
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
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

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
  // the exit animation plays.
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [expand] = React.useState(() => new Animated.Value(0));
  const { lift, height: barHeight } = bar;

  // One node for the whole session: the sheet re-renders on every
  // keystroke, and a fresh node each time would attach and detach
  // listeners while the user types.
  const dockBottom = React.useMemo(
    () =>
      expand.interpolate({
        inputRange: [0, 1],
        outputRange: [barHeight + spacing.s + insets.bottom, spacing.s],
      }),
    [expand, barHeight, insets.bottom],
  );
  const scrimBottom = React.useMemo(
    () =>
      lift.interpolate({
        inputRange: [0, 1],
        outputRange: [0, barHeight],
      }),
    [lift, barHeight],
  );

  React.useEffect(() => {
    // One clock for the sheet's travel and the bar's collapse: both
    // start and finish on the same frame, so the close reads as a
    // single motion.
    const animation = Animated.parallel([
      Animated.timing(expand, {
        toValue: open ? 1 : 0,
        duration: travelMs,
        useNativeDriver: false,
      }),
      Animated.timing(lift, {
        toValue: open ? 0 : 1,
        duration: travelMs,
        useNativeDriver: false,
      }),
    ]);
    animation.start(({ finished }) => {
      // The sheet leaves the tree when its exit has played, not on a
      // timer: the closing frame keeps the input's height, and a
      // reopened sheet cancels the unmount.
      if (finished && !open) {
        setMounted(false);
      }
    });
    return () => animation.stop();
  }, [expand, lift, open]);

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
    expand,
    dockBottom,
    scrim: { bottom: scrimBottom, height: window.height },
    toast,
    toggle: () => (open ? close() : openSheet()),
    close,
  };
}
