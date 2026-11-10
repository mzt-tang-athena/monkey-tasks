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
import { colors } from "@/theme/tokens";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";
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
};

/**
 * Two panes and a grabber, laid out by fraction. At rest each pane is a
 * `flexGrow` from the fraction, so the first frame needs no layout
 * report and no px default. A grabber drag moves the split on the UI
 * thread, clamped to `minTop` and `minBottom` against the height it
 * measured at pickup, and one `onResize` reports the release.
 */
export function Split({
  fraction,
  onResize,
  minTop,
  minBottom,
  top,
  bottom,
  testID,
}: SplitProps) {
  const self = useAnimatedRef<View>();
  const grow = useSharedValue(fraction);
  const box = useSharedValue(0);
  const startTop = useSharedValue(0);
  const startY = useSharedValue(0);
  const grabbing = useSharedValue(0);
  const [hot, setHot] = React.useState(false);
  const pressCancel = usePressCancel();

  // A new fraction from the screen, before paint: the panes never show
  // a frame between the release and the state that carries it.
  React.useLayoutEffect(() => {
    grow.set(fraction);
  }, [fraction, grow]);

  const gesture = usePanGesture(
    withTouchAction("none", {
      minDistance: 0,
      onBegin: () => {
        "worklet";
        grabbing.set(1);
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
        startY.set(e.absoluteY);
      },
      onUpdate: (e) => {
        "worklet";
        const usable = box.value - dividerHeight;
        if (grabbing.value !== 1 || usable <= 0) {
          return;
        }
        const raw = startTop.value + (e.absoluteY - startY.value);
        const clamped = Math.min(
          Math.max(raw, minTop),
          Math.max(usable - minBottom, minTop),
        );
        grow.set(clamped / usable);
      },
      onFinalize: () => {
        "worklet";
        if (grabbing.value === 1) {
          grabbing.set(0);
          toJS(onResize, grow.value);
        }
      },
    }),
  );

  const topStyle = useAnimatedStyle(() => ({ flexGrow: grow.value }));
  const bottomStyle = useAnimatedStyle(() => ({ flexGrow: 1 - grow.value }));
  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: grabbing.value > 0 ? colors.accent : colors.inkFaint,
  }));

  return (
    <Animated.View ref={self} testID={testID} style={styles.root}>
      <Animated.View
        testID={testID == null ? undefined : `${testID}:top`}
        style={[styles.pane, topStyle]}
      >
        {top}
      </Animated.View>
      <View style={styles.divider}>
        <View style={[styles.line, hot && styles.lineHot]} />
        <GestureDetector gesture={gesture}>
          <Animated.View
            testID={testID == null ? undefined : `${testID}:grip`}
            style={[styles.grip, hot && styles.gripHot]}
            accessibilityRole="button"
            accessibilityLabel="resize timeline"
            // The hover handlers are React Native Web's, which the
            // native props type omits. A surface only, so the cast
            // stays here.
            {...({
              onHoverIn: () => setHot(true),
              onHoverOut: () => setHot(false),
            } as object)}
          >
            <Animated.View style={[styles.bar, barStyle]} />
          </Animated.View>
        </GestureDetector>
      </View>
      <Animated.View
        testID={testID == null ? undefined : `${testID}:bottom`}
        style={[styles.pane, bottomStyle]}
      >
        {bottom}
      </Animated.View>
    </Animated.View>
  );
}

/** The same split held still: a preview of a day the swipe reveals. */
export function SplitStill(props: Omit<SplitProps, "onResize">) {
  return (
    <View testID={props.testID} style={styles.root}>
      <View
        testID={props.testID == null ? undefined : `${props.testID}:top`}
        style={[styles.pane, { flexGrow: props.fraction }]}
      >
        {props.top}
      </View>
      <View style={styles.divider}>
        <View style={styles.line} />
        <View style={styles.grip}>
          <View style={[styles.bar, styles.barRest]} />
        </View>
      </View>
      <View
        testID={props.testID == null ? undefined : `${props.testID}:bottom`}
        style={[styles.pane, { flexGrow: 1 - props.fraction }]}
      >
        {props.bottom}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  pane: {
    flexBasis: 0,
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
  grip: {
    alignSelf: "center",
    width: 72,
    height: dividerHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
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
});
