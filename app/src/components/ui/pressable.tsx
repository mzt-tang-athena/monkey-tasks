import * as React from "react";
// eslint-disable-next-line no-restricted-imports -- the web half of the shared press, see below
import { Platform, Pressable as WebPressable } from "react-native";
import { Pressable as PanPressable } from "react-native-gesture-handler";
import { motion } from "@/lib/motion/tokens";

/**
 * The app's press (ADR 0046).
 *
 * On the web it is React Native's Pressable, which fires from the
 * browser's click. That click survives a row that mounts or re-renders
 * under the finger, and it needs no layout report. The gesture handler
 * press it replaces fired from pointer up, and its web build dropped a
 * press on a view before its first layout report or after the view was
 * replaced.
 *
 * A browser click also follows a pointer that travelled, which the old
 * press cancelled on pointer leave. The web press tracks the pointer
 * past the hold's slop and drops its own press when it has travelled.
 * A surface swallows the one click a pan activation leaves behind, in
 * `components/motion/internal/press-cancel`, for a hold that did not
 * move. On native the press stays gesture handler's, which a pan
 * cancels itself.
 */
type PressProps = React.ComponentProps<typeof WebPressable>;

/** The pointer travelled this far from its press: no press. */
const slop = motion.hold.slop;

type Tracker = {
  begin: (event: { nativeEvent: { pageX?: number; pageY?: number } }) => void;
  /** The press let go: stop tracking and keep the verdict. */
  end: () => void;
  /** The click arrived: true when the pointer had travelled. */
  consume: () => boolean;
};

const WebPress = React.forwardRef<
  React.ComponentRef<typeof WebPressable>,
  PressProps
>(function WebPress(props, ref) {
  const [tracker] = React.useState<Tracker>(() => {
    const state = {
      start: null as { x: number; y: number } | null,
      moved: false,
      verdict: false,
    };
    const onMove = (event: PointerEvent) => {
      const start = state.start;
      if (start === null) {
        return;
      }
      if (Math.hypot(event.pageX - start.x, event.pageY - start.y) > slop) {
        state.moved = true;
      }
    };
    const stop = () => window.removeEventListener("pointermove", onMove, true);
    return {
      begin(event) {
        const x = event.nativeEvent.pageX;
        const y = event.nativeEvent.pageY;
        stop();
        state.start = x == null || y == null ? null : { x, y };
        state.moved = false;
        state.verdict = false;
        if (state.start !== null) {
          window.addEventListener("pointermove", onMove, true);
        }
      },
      end() {
        stop();
        state.verdict = state.moved;
        state.moved = false;
        state.start = null;
      },
      consume() {
        const moved = state.verdict;
        state.verdict = false;
        return moved;
      },
    };
  });

  return (
    <WebPressable
      {...props}
      ref={ref}
      onPressIn={(event) => {
        tracker.begin(event);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        tracker.end();
        props.onPressOut?.(event);
      }}
      onPress={(event) => {
        if (!tracker.consume()) {
          props.onPress?.(event);
        }
      }}
    />
  );
});

/** Every press target, with or without a pan above it. */
export const Pressable = (Platform.OS === "web" ? WebPress : PanPressable) as typeof PanPressable;
