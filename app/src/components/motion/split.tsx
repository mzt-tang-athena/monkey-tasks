/* eslint-disable react-hooks/refs -- the worklet reads the animated
   ref when the gesture runs, not during render. */
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { radius, touchTarget, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { clampFraction, clampTop } from "@/lib/motion/split-math";
import { motion } from "@/lib/motion/tokens";
import { useProgress } from "@/lib/motion/progress";
import { Pressable } from "@/components/ui/pressable";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";
import { useActivateKeys, useArrowKeys } from "./internal/keys";
import { usePressCancel } from "./internal/press-cancel";

const dividerHeight = 28;

export type SplitProps = {
  /** The top pane's share of the space under the divider, 0 to 1. */
  fraction: number;
  onResize: (fraction: number) => void;
  minTop: number;
  minBottom: number;
  top: React.ReactNode;
  bottom: React.ReactNode;
  testID?: string;
  /** The bottom pane is hidden: the top takes every pixel but the
      divider. The fraction stays, so showing returns to it. */
  collapsed?: boolean;
  /** A tap on the grabber, or Enter on it, asks to hide or show. */
  onToggle?: () => void;
};

/**
 * The hide of a split's bottom pane: a 0 to 1 clock on the UI thread,
 * and whether the pane still mounts. A hidden pane leaves the tree
 * once the clock lands, so a keyboard or a screen reader never reaches
 * a row with no height. It mounts again before the clock starts.
 */
function useCollapse(collapsed: boolean) {
  const [gone, setGone] = React.useState(collapsed);
  const hide = useProgress(collapsed, {
    ms: motion.ms.settle,
    onSettled: (at) => setGone(at === 1),
  });
  return { hide, mounted: !(collapsed && gone) };
}

/**
 * Two panes and a grabber, laid out by fraction. At rest each pane is a
 * `flexGrow` from the fraction, so the first frame needs no layout
 * report and no px default. A grabber drag moves the split on the UI
 * thread, clamped to `minTop` and `minBottom` against the height it
 * measured at pickup, and one `onResize` reports the release. A new
 * height re-clamps the stored share, so a valid split stays valid when
 * the screen shrinks.
 */
export function Split({
  fraction,
  onResize,
  minTop,
  minBottom,
  top,
  bottom,
  testID,
  collapsed = false,
  onToggle,
}: SplitProps) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { hide, mounted } = useCollapse(collapsed);
  const self = useAnimatedRef<View>();
  const grow = useSharedValue(fraction);
  const box = useSharedValue(0);
  const startTop = useSharedValue(0);
  const startY = useSharedValue(0);
  const startGrow = useSharedValue(0);
  const grabbing = useSharedValue(0);
  const moved = useSharedValue(0);
  const [hot, setHot] = React.useState(false);
  const pressCancel = usePressCancel();
  const gripRef = React.useRef<React.ComponentRef<typeof Animated.View>>(null);
  const height = React.useRef(0);
  // A key press can land before the root's first layout report, when
  // its height is still unknown. The step waits in this slot and runs
  // on that report, so the press is not lost.
  const pendingStep = React.useRef<1 | -1 | null>(null);

  // One hour row of the timeline is one touch target tall. Keyboard
  // arrows and TalkBack's increment and decrement move the split by
  // that row, so the grabber has a non-drag path.
  const applyStep = React.useCallback(
    (direction: 1 | -1) => {
      const usable = height.current - dividerHeight;
      if (usable <= 0) {
        return;
      }
      const top = clampTop(
        fraction * usable + direction * touchTarget,
        usable,
        minTop,
        minBottom,
      );
      onResize(top / usable);
    },
    [fraction, minTop, minBottom, onResize],
  );

  const step = React.useCallback(
    (direction: 1 | -1) => {
      if (height.current - dividerHeight <= 0) {
        pendingStep.current = direction;
        return;
      }
      applyStep(direction);
    },
    [applyStep],
  );

  const toggle = React.useCallback(() => onToggle?.(), [onToggle]);

  useArrowKeys(gripRef, step);
  useActivateKeys(gripRef, toggle);

  // A new fraction from the screen, before paint: the panes never show
  // a frame between the release and the state that carries it. A share
  // the current height no longer allows lands on its floor instead.
  React.useLayoutEffect(() => {
    const usable = height.current - dividerHeight;
    grow.set(
      usable > 0 ? clampFraction(fraction, usable, minTop, minBottom) : fraction,
    );
  }, [fraction, grow, minTop, minBottom]);

  const gesture = usePanGesture(
    withTouchAction("none", {
      minDistance: 0,
      onBegin: () => {
        "worklet";
        grabbing.set(1);
        moved.set(0);
      },
      onActivate: (e) => {
        "worklet";
        toJS(pressCancel.arm);
        const measured = measure(self);
        if (measured === null) {
          return;
        }
        box.set(measured.height);
        startTop.set(grow.value * Math.max(measured.height - dividerHeight, 0));
        startGrow.set(grow.value);
        startY.set(e.absoluteY);
      },
      onUpdate: (e) => {
        "worklet";
        const usable = box.value - dividerHeight;
        if (grabbing.value !== 1 || usable <= 0) {
          return;
        }
        if (Math.abs(e.absoluteY - startY.value) > motion.hold.slop) {
          moved.set(1);
        }
        // A hidden list has no split to drag: the grabber only taps.
        if (hide.value > 0) {
          return;
        }
        const raw = startTop.value + (e.absoluteY - startY.value);
        grow.set(clampTop(raw, usable, minTop, minBottom) / usable);
      },
      onFinalize: (e) => {
        "worklet";
        if (grabbing.value !== 1) {
          return;
        }
        grabbing.set(0);
        // A press that never travelled is a tap, not a resize.
        if (moved.value === 0) {
          grow.set(startGrow.value);
          if (!e.canceled) {
            toJS(toggle);
          }
          return;
        }
        if (hide.value === 0) {
          toJS(onResize, grow.value);
        }
      },
    }),
  );

  const topStyle = useAnimatedStyle(() => ({
    flexGrow: grow.value + (1 - grow.value) * hide.value,
  }));
  const bottomStyle = useAnimatedStyle(() => ({
    flexGrow: (1 - grow.value) * (1 - hide.value),
  }));
  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: grabbing.value > 0 ? colors.accent : colors.inkFaint,
  }));

  return (
    <Animated.View
      ref={self}
      testID={testID}
      style={styles.root}
      onLayout={(event) => {
        height.current = event.nativeEvent.layout.height;
        if (pendingStep.current != null) {
          const direction = pendingStep.current;
          pendingStep.current = null;
          applyStep(direction);
          return;
        }
        const usable = height.current - dividerHeight;
        if (usable <= 0) {
          return;
        }
        const next = clampFraction(fraction, usable, minTop, minBottom);
        if (Math.abs(next - fraction) * usable > 0.5) {
          grow.set(next);
          onResize(next);
        }
      }}
    >
      <Animated.View
        testID={testID == null ? undefined : `${testID}:top`}
        style={[styles.pane, topStyle]}
      >
        {top}
      </Animated.View>
      <Divider
        testID={testID}
        hot={hot}
        grip={
          <GestureDetector gesture={gesture}>
            <Animated.View
              ref={gripRef}
              testID={testID == null ? undefined : `${testID}:grip`}
              style={[styles.grip, hot && styles.gripHot]}
              // "adjustable" is React Native's slider role. The web build
              // maps it to `slider`, and the arrows follow the same step
              // as TalkBack's increment and decrement. A hidden list has
              // nothing to resize, so the grabber is a button that shows
              // it again.
              accessibilityRole={collapsed ? "button" : "adjustable"}
              accessibilityLabel={collapsed ? "show tasks" : "resize timeline"}
              accessibilityValue={
                collapsed
                  ? undefined
                  : { min: 0, max: 100, now: Math.round(fraction * 100) }
              }
              aria-valuemin={collapsed ? undefined : 0}
              aria-valuemax={collapsed ? undefined : 100}
              aria-valuenow={collapsed ? undefined : Math.round(fraction * 100)}
              accessibilityActions={
                collapsed
                  ? [{ name: "activate", label: "show tasks" }]
                  : [
                      { name: "increment" },
                      { name: "decrement" },
                      { name: "hide", label: "hide tasks" },
                    ]
              }
              onAccessibilityAction={(event) => {
                const name = event.nativeEvent.actionName;
                if (name === "increment" || name === "decrement") {
                  step(name === "increment" ? 1 : -1);
                  return;
                }
                toggle();
              }}
              tabIndex={0}
              // The hover handlers are React Native Web's, which the
              // native props type omits. A surface only, so the cast
              // stays here.
              {...({
                onHoverIn: () => setHot(true),
                onHoverOut: () => setHot(false),
              } as object)}
            >
              <Animated.View
                testID={testID == null ? undefined : `${testID}:bar`}
                style={[styles.bar, barStyle]}
              />
            </Animated.View>
          </GestureDetector>
        }
      />
      <Animated.View
        testID={testID == null ? undefined : `${testID}:bottom`}
        style={[styles.pane, bottomStyle]}
      >
        {mounted ? bottom : null}
      </Animated.View>
    </Animated.View>
  );
}

/** The same split held still: a preview of a day the swipe reveals. */
export function SplitStill(
  props: Omit<SplitProps, "onResize" | "onToggle">,
) {
  const { styles } = useThemedStyles(makeStyles);
  const collapsed = props.collapsed === true;
  return (
    <View testID={props.testID} style={styles.root}>
      <View
        testID={props.testID == null ? undefined : `${props.testID}:top`}
        style={[styles.pane, { flexGrow: collapsed ? 1 : props.fraction }]}
      >
        {props.top}
      </View>
      <Divider testID={props.testID} />
      <View
        testID={props.testID == null ? undefined : `${props.testID}:bottom`}
        style={[styles.pane, { flexGrow: collapsed ? 0 : 1 - props.fraction }]}
      >
        {collapsed ? null : props.bottom}
      </View>
    </View>
  );
}

/**
 * The split with the top pane at its own height: the week and month
 * cards. The card keeps the height its content gives it, the divider
 * draws the day's edge, and the list below fills the rest and clips at
 * its top. A collapse hands the list's room to the card, which stretches
 * into it. The grip is a button, because a card with an intrinsic
 * height has no split to drag. A tap on it hides or shows the list.
 */
export function SplitFit({
  top,
  bottom,
  testID,
  collapsed = false,
  onToggle,
}: {
  top: React.ReactNode;
  bottom: React.ReactNode;
  testID?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { hide, mounted } = useCollapse(collapsed);
  const [hot, setHot] = React.useState(false);
  const topStyle = useAnimatedStyle(() => ({ flexGrow: hide.value }));
  const bottomStyle = useAnimatedStyle(() => ({ flexGrow: 1 - hide.value }));
  return (
    <View testID={testID} style={styles.root}>
      <Animated.View
        testID={testID == null ? undefined : `${testID}:top`}
        style={[styles.fit, topStyle]}
      >
        {top}
      </Animated.View>
      <Divider
        testID={testID}
        hot={hot}
        grip={
          <Pressable
            testID={testID == null ? undefined : `${testID}:grip`}
            style={[styles.grip, hot && styles.gripHot]}
            onPress={onToggle}
            onHoverIn={() => setHot(true)}
            onHoverOut={() => setHot(false)}
            accessibilityRole="button"
            accessibilityLabel={collapsed ? "show tasks" : "hide tasks"}
          >
            <View
              testID={testID == null ? undefined : `${testID}:bar`}
              style={[styles.bar, styles.barRest]}
            />
          </Pressable>
        }
      />
      <Animated.View
        testID={testID == null ? undefined : `${testID}:bottom`}
        style={[styles.fill, bottomStyle]}
      >
        {mounted ? bottom : null}
      </Animated.View>
    </View>
  );
}

/** The one divider: a dashed rule with the grip's box centered on it.
    A live split hands in the grip with its gesture; the still shapes
    draw the resting bar. */
function Divider({
  testID,
  hot = false,
  grip,
}: {
  testID?: string;
  hot?: boolean;
  grip?: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.divider}>
      <View style={[styles.line, hot && styles.lineHot]} />
      <View style={styles.gripSlot}>
        {grip ?? (
          <View style={styles.grip}>
            <View
              testID={testID == null ? undefined : `${testID}:bar`}
              style={[styles.bar, styles.barRest]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    root: {
      flex: 1,
      overflow: "hidden",
    },
    pane: {
      flexBasis: 0,
      overflow: "hidden",
    },
    // The fit shape: the top pane keeps its content height, so a card
    // never stretches or clips.
    fit: {
      flexShrink: 0,
    },
    // The list under a fit top fills the rest and clips at the divider.
    fill: {
      flex: 1,
      overflow: "hidden",
    },
    divider: {
      height: dividerHeight,
      justifyContent: "center",
    },
    line: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 13,
      borderTopWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.hairline,
    },
    lineHot: {
      borderTopColor: colors.accent,
    },
    // The divider keeps its 28pt height; the grabber's box is 44 tall,
    // centered on it, so small fingers still reach it.
    gripSlot: {
      alignSelf: "center",
      width: 72,
      height: dividerHeight,
      position: "relative",
    },
    grip: {
      position: "absolute",
      top: (dividerHeight - touchTarget) / 2,
      left: 0,
      width: 72,
      height: touchTarget,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius,
    },
    gripHot: {
      backgroundColor: colors.pressed,
    },
    bar: {
      width: 44,
      height: 6,
      borderRadius: 3,
    },
    barRest: {
      backgroundColor: colors.inkFaint,
    },
  }),
});
