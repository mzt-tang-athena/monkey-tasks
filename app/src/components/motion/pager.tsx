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
import type { PageFollow } from "./page-follow";
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
 * `renderPreview(page)` at the host's measured box, so it lays out
 * before it shows. The screen only sets `index`: one page away
 * slides, and a longer jump cuts. A landing calls `onPage(next)` once
 * (ADR 0033, ADR 0046). A `follow` publishes the live page position,
 * so chrome can track the swipe on the UI thread.
 */
export function Pager({
  index,
  bounds = {},
  onPage,
  renderPreview,
  fill = false,
  enabled = true,
  follow: tracker,
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
  /** Chrome that tracks this pager's live position. */
  follow?: PageFollow;
  testID?: string;
  children: React.ReactNode;
}) {
  // Pages count from the mount's index, so the first frame is at 0.
  const [origin] = React.useState(index);
  const pressCancel = usePressCancel();
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  // The same box as React state, so a preview lays out at the live
  // page's size in the render that mounts it. A shared value alone
  // updates the track one frame later and shows a blank strip. A
  // preview that reads a percentage instead takes its height from the
  // track, which holds only positioned children and so has none.
  const [host, setHost] = React.useState({ width: 0, height: 0 });
  // A follow lends its own values, so tracking costs no extra write.
  const ownPos = useSharedValue(0);
  const pos = tracker?.progress ?? ownPos;
  const landed = useSharedValue(0);
  // The page a settle is heading to, until it lands or a touch takes it.
  const pending = useSharedValue(none);
  const anchor = useSharedValue(0);
  const ownPage = useSharedValue(index - origin);
  const page = tracker?.page ?? ownPage;
  const edges = useSharedValue<PageBounds>({});

  // A screen that swaps one pager for another on the same link leaves
  // its live position behind. A fresh mount stands on its first page.
  React.useLayoutEffect(() => {
    tracker?.progress.set(0);
  }, [tracker]);

  React.useLayoutEffect(() => {
    page.set(index - origin);
    edges.set({
      first: bounds.first === undefined ? undefined : bounds.first - origin,
      last: bounds.last === undefined ? undefined : bounds.last - origin,
    });
    // The origin names the page the tracker's progress counts from.
    if (tracker != null && tracker.origin.value !== origin) {
      tracker.origin.set(origin);
    }
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
        if (tracker != null) {
          tracker.touching.set(1);
        }
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
      onFinalize: () => {
        "worklet";
        if (tracker != null) {
          tracker.touching.set(0);
        }
      },
    }),
  );

  const live = index - origin;
  const previews = visible
    .split(",")
    .map(Number)
    .filter((rel) => rel !== live);

  // The track moves through page space, so a page `rel` sits at
  // `(rel - live) * width` in it. The track also carries the live page's
  // own place as a plain offset, which keeps its box over the host at
  // rest. The live page rides at the track's origin, so a commit swaps
  // its content and its place in the same render, and the animated
  // style moves only the track. Taking the offset from a shared value
  // instead puts the live page one page over for a frame at each
  // landing (ticket 20261118). The track's box stays on screen at rest,
  // so Android keeps the live page's rows and TalkBack reads the tab
  // (ticket 0079, again in ticket 20261117).
  const track = useAnimatedStyle(() => ({
    transform: [{ translateX: -pos.value * width.value }],
  }));
  const shift = { left: live * host.width };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: next, height } = event.nativeEvent.layout;
    width.set(next);
    setHost((was) =>
      was.width === next && was.height === height ? was : { width: next, height },
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View testID={testID} style={[styles.host, fill && styles.fill]} onLayout={onLayout}>
        <Animated.View
          testID="pager-track"
          style={[fill && styles.fill, shift, track]}
        >
          {/* One element for the pager's life, at the track's origin.
              Keeping it mounted keeps the page's scroll and rows across
              a swipe, and its place stays plain, so a commit moves it
              with its content. */}
          <View testID="pager-live" style={fill && styles.live}>
            {children}
          </View>
          {previews.map((rel) => (
            <View
              key={`preview:${rel}`}
              testID={`preview:${origin + rel}`}
              style={[
                styles.preview,
                {
                  left: (rel - live) * host.width,
                  width: host.width,
                  height: host.height,
                },
              ]}
            >
              {renderPreview(origin + rel)}
            </View>
          ))}
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
  // A filling pager takes its size from the host, so the live page is
  // absolute and fills it. A pager that sizes to its page keeps the live
  // page in flow, where it gives the host its height.
  live: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flex: 1,
  },
  preview: {
    position: "absolute",
    top: 0,
  },
});
