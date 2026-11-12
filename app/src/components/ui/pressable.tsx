import * as React from "react";
// eslint-disable-next-line no-restricted-imports -- the web half of the shared press, see below
import { Platform, Pressable as WebPressable, type ViewStyle } from "react-native";
import { Pressable as PanPressable } from "react-native-gesture-handler";
import { motion } from "@/lib/motion/tokens";
import type { Palette } from "@/theme/tokens";
import { useTheme } from "@/theme/theme-provider";

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

/**
 * The keyboard focus mark on the web, in the active palette. Two pixels
 * of the ring color sit at the target's edge and two pixels of its
 * `onAccent` sit inside them. One of the two always reads: the ring
 * color against a light fill, the inner band against an accent fill,
 * which no single color can clear (ADR 20261112-control-focus-ring).
 * Both paint inside the target, so nothing moves and no parent can
 * clip the mark.
 */
function focusMark(colors: Palette): ViewStyle {
  return {
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineColor: colors.focusRing,
    outlineOffset: -2,
    boxShadow: `inset 0 0 0 4px ${colors.onAccent}`,
  };
}

/**
 * The browser draws its own ring on a focus it calls visible, and it
 * keeps that verdict after a press on an already focused control. The
 * shared mark replaces it, so a pointer never leaves one behind. RN's
 * style type leaves out `none`, which the web takes.
 */
const noMark = { outlineStyle: "none" } as unknown as ViewStyle;

const WebPress = React.forwardRef<
  React.ComponentRef<typeof WebPressable>,
  PressProps
>(function WebPress(props, ref) {
  const { colors } = useTheme();
  const [keyboardFocus, setKeyboardFocus] = React.useState(false);
  const mark = React.useMemo(() => focusMark(colors), [colors]);
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
      style={(state) => {
        const own =
          typeof props.style === "function" ? props.style(state) : props.style;
        return [own, keyboardFocus ? mark : noMark];
      }}
      onFocus={(event) => {
        // The browser's own test, so a mouse press keeps the ring off.
        const target = event.target as unknown as HTMLElement | null;
        setKeyboardFocus(
          props.disabled !== true &&
            (target?.matches(":focus-visible") ?? false),
        );
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setKeyboardFocus(false);
        props.onBlur?.(event);
      }}
      // A press is pointer input, so it drops a ring the keyboard put
      // there. The browser fires no second focus event for it.
      // eslint-disable-next-line no-restricted-syntax -- the shared press owns pointer input on the web, next to its slop tracker
      onPointerDown={(event) => {
        setKeyboardFocus(false);
        props.onPointerDown?.(event);
      }}
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

/**
 * Every press target, with or without a pan above it. On the web a
 * keyboard focus draws the shared mark, and native keeps its touch
 * behaviour with no ring.
 */
export const Pressable = (Platform.OS === "web" ? WebPress : PanPressable) as typeof PanPressable;
