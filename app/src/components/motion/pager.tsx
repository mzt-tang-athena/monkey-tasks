import * as React from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { follow, releaseTarget, visiblePages, type PageBounds } from "@/lib/motion/pager-math";
import { motion } from "@/lib/motion/tokens";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";
import { usePressCancel } from "./internal/press-cancel";

const none = Number.NaN;
const slop: [number, number] = [-motion.swipe.slop, motion.swipe.slop];

function over(ms: number) {
  "worklet";
  return { duration: ms, easing: motion.easeOut, reduceMotion: ReduceMotion.System };
}

/**
 * A horizontal pager. The page under the finger follows it, and a
 * release past the threshold or a flick lands on the next page. The
 * live page renders `children` in one element for the pager's life, so
 * a page keeps its state across a swipe. A neighbour on screen renders
 * `renderPreview(page)`. The screen only sets `index`: one page away
 * slides, and a longer jump cuts. A landing calls `onPage(next)` once
 * (ADR 0033, ADR 0046).
 */
export function Pager({
  index,
  bounds = {},
  onPage,
  renderPreview,
  fill = false,
  enabled = true,
  testID,
  children,
}: {
  index: number;
  bounds?: PageBounds;
  onPage: (next: number) => void;
  renderPreview: (page: number) => React.ReactNode;
  fill?: boolean;
  /** False while a drag surface under the same root owns the
      gesture, so a row drag never turns a page. */
  enabled?: boolean;
  testID?: string;
  children: React.ReactNode;
}) {
  // Pages count from the mount's index, so the first frame is at 0.
  const [origin] = React.useState(index);
  const pressCancel = usePressCancel();
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  // The same width as React state, so the live page's own offset
  // applies in the same render as its content. A shared value alone
  // updates the track one frame later and shows a blank strip.
  const [hostWidth, setHostWidth] = React.useState(0);
  const pos = useSharedValue(0);
  const landed = useSharedValue(0);
  // The page a settle is heading to, until it lands or a touch takes it.
  const pending = useSharedValue(none);
  const anchor = useSharedValue(0);
  const page = useSharedValue(index - origin);
  const edges = useSharedValue<PageBounds>({});

  React.useLayoutEffect(() => {
    page.set(index - origin);
    edges.set({
      first: bounds.first === undefined ? undefined : bounds.first - origin,
      last: bounds.last === undefined ? undefined : bounds.last - origin,
    });
  });

  const latest = React.useRef(onPage);
  React.useLayoutEffect(() => {
    latest.current = onPage;
  });
  const [commit] = React.useState(() => (rel: number) => latest.current(origin + rel));

  const [visible, setVisible] = React.useState("0");
  useAnimatedReaction(
    () => visiblePages(pos.value, width.value).join(","),
    (key, previous) => {
      if (key !== previous) {
        toJS(setVisible, key);
      }
    },
  );

  // A new index from the screen: one page slides from where the track
  // stands, a longer jump cuts. The pager's own landing already stands
  // there.
  useAnimatedReaction(
    () => page.value,
    (rel) => {
      if (rel === landed.value) {
        return;
      }
      pending.set(none);
      landed.set(rel);
      if (Math.abs(rel - pos.value) <= 1) {
        pos.set(withTiming(rel, over(motion.ms.settle)));
      } else {
        pos.set(rel);
      }
    },
  );

  const gesture = usePanGesture(
    withTouchAction("pan-y", {
      enabled,
      activeOffsetX: slop,
      failOffsetY: slop,
      onBegin: () => {
        "worklet";
        // A touch during a settle lands the pending page now, so the
        // next gesture starts from it.
        if (!Number.isNaN(pending.value)) {
          const to = pending.value;
          pending.set(none);
          landed.set(to);
          toJS(commit, to);
        }
      },
      onActivate: () => {
        "worklet";
        toJS(pressCancel.arm);
        // Writing the value stops a settle in flight.
        anchor.set(pos.value);
        pos.set(anchor.value);
      },
      onUpdate: (e) => {
        "worklet";
        if (reduced || width.value === 0) {
          return;
        }
        pos.set(anchor.value - follow(e.translationX, edges.value, landed.value) / width.value);
      },
      onDeactivate: (e) => {
        "worklet";
        const base = landed.value;
        const step = e.canceled
          ? 0
          : releaseTarget({
              dx: e.translationX,
              vx: e.velocityX,
              width: width.value,
              bounds: edges.value,
              page: base,
            });
        const target = base + step;
        if (step !== 0) {
          pending.set(target);
        }
        const ms = step === 0 ? motion.ms.return : motion.ms.settle;
        pos.set(
          withTiming(target, over(ms), (finished) => {
            "worklet";
            if (finished === true && pending.value === target) {
              pending.set(none);
              landed.set(target);
              toJS(commit, target);
            }
          }),
        );
      },
    }),
  );

  const live = index - origin;
  const previews = visible
    .split(",")
    .map(Number)
    .filter((rel) => rel !== live);

  // The track moves through page space: a page `rel` sits at
  // `rel * width`, so the live page's own offset plus the track's
  // offset is always `(live - pos) * width`. The track reads only the
  // animated position. The live page carries its `live` offset as a
  // plain style, so a commit swaps its content and its place in one
  // frame. It still lays out at the track's origin, which keeps every
  // row inside the host for Android's virtualized list (ticket 0079).
  const track = useAnimatedStyle(() => ({
    transform: [{ translateX: -pos.value * width.value }],
  }));
  const liveShift = {
    transform: [{ translateX: live * hostWidth }],
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    width.set(next);
    setHostWidth(next);
  };

  return (
    <GestureDetector gesture={gesture}>
      <View testID={testID} style={[styles.host, fill && styles.fill]} onLayout={onLayout}>
        <Animated.View testID="pager-track" style={[fill && styles.fill, track]}>
          {previews.map((rel) => (
            <View
              key={`preview:${rel}`}
              testID={`preview:${origin + rel}`}
              style={[styles.preview, { left: `${rel * 100}%` }]}
            >
              {renderPreview(origin + rel)}
            </View>
          ))}
          {/* One element for the pager's life. Keeping it mounted keeps
              the page's scroll and rows across a swipe. */}
          <View
            testID="pager-live"
            style={[fill && styles.fill, liveShift]}
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: {
    overflow: "hidden",
  },
  fill: {
    flex: 1,
  },
  preview: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "100%",
  },
});
