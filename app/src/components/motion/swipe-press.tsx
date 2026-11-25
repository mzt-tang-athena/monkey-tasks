import * as React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { PageBounds } from "@/lib/motion/pager-math";
import { swipeAction, swipeNudge, type SwipeAction } from "@/lib/motion/swipe-press";
import { motion } from "@/lib/motion/tokens";
import { Pressable } from "@/components/ui/pressable";
import { toJS } from "./internal/bridge";
import { withTouchAction } from "./internal/gesture";
import { useSwipeKeys } from "./internal/keys";
import { usePressCancel } from "./internal/press-cancel";

export type SwipePressRef = React.ComponentRef<typeof Pressable>;

/** The three jobs the target offers assistive tech, and the arrow keys. */
const actions = [
  { name: "commands", label: "Open commands" },
  { name: "next", label: "Next tab" },
  { name: "previous", label: "Previous tab" },
] as const;

type Action = Exclude<SwipeAction, "none">;

function isAction(name: string): name is Action {
  return name === "commands" || name === "next" || name === "previous";
}

/**
 * A press target that also reads three swipes: down asks for the
 * commands, and left or right for the tab on that side. The target
 * moves a little with the finger, so a swipe reads as a swipe where a
 * still button would feel like a missed tap. A release under the
 * commit runs the press, so a tap that moved a little still acts.
 *
 * A sideways swipe stops at the ends, as a pager does, and the target
 * barely moves past one. The same three jobs sit on it as custom
 * actions for TalkBack, and on the arrow keys while it holds focus.
 *
 * The caller owns the look: `style` draws the target and `pressedStyle`
 * fills it while a finger is down.
 */
export function SwipePress({
  label,
  at,
  count,
  onStep,
  style,
  pressedStyle,
  testID,
  ref,
  children,
}: {
  /** The target's accessible name, such as "add task". */
  label: string;
  /** The page the bar stands on, counted from the first. */
  at: number;
  /** How many pages the bar carries. */
  count: number;
  /** Runs once per gesture that reaches an action, from a finger, a
      screen reader or a key. */
  onStep: (action: Action) => void;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  testID?: string;
  ref?: React.Ref<SwipePressRef>;
  children: React.ReactNode;
}) {
  const pressCancel = usePressCancel();
  const reduced = useReducedMotion();
  const target = React.useRef<SwipePressRef | null>(null);
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const page = useSharedValue(at);
  const bounds = useSharedValue<PageBounds>({ first: 0, last: count - 1 });

  React.useLayoutEffect(() => {
    page.set(at);
    bounds.set({ first: 0, last: count - 1 });
  }, [at, count, page, bounds]);

  // A gesture can outlive the render that made it, so the surface reads
  // the caller's latest step.
  const latest = React.useRef(onStep);
  React.useLayoutEffect(() => {
    latest.current = onStep;
  });
  const [step] = React.useState(() => (action: SwipeAction) => {
    if (action !== "none") {
      latest.current(action);
    }
  });

  // The target returns to rest the same way whatever the release did,
  // so a page that moves does not move it too.
  const settle = () => {
    "worklet";
    nudgeX.set(
      withSpring(0, {
        damping: motion.spring.pane.damping,
        stiffness: motion.spring.pane.stiffness,
        mass: motion.spring.pane.mass,
        reduceMotion: ReduceMotion.System,
      }),
    );
    nudgeY.set(
      withSpring(0, {
        damping: motion.spring.pane.damping,
        stiffness: motion.spring.pane.stiffness,
        mass: motion.spring.pane.mass,
        reduceMotion: ReduceMotion.System,
      }),
    );
  };

  const gesture = usePanGesture(
    withTouchAction("none", {
      // The target takes the finger from where the press lets go, so no
      // travel falls between a press and a swipe.
      activeOffsetX: [-motion.hold.slop, motion.hold.slop] as [number, number],
      activeOffsetY: [-motion.hold.slop, motion.hold.slop] as [number, number],
      // The travel is the finger's own, from where it touched down. A
      // pan's own translation starts again at its activation point on the
      // web, so it would measure a shorter swipe than the phone does.
      onBegin: (event) => {
        "worklet";
        fromX.set(event.absoluteX);
        fromY.set(event.absoluteY);
      },
      onActivate: () => {
        "worklet";
        toJS(pressCancel.arm);
      },
      onUpdate: (event) => {
        "worklet";
        if (reduced) {
          return;
        }
        const nudge = swipeNudge({
          dx: event.absoluteX - fromX.value,
          dy: event.absoluteY - fromY.value,
          at: page.value,
          bounds: bounds.value,
        });
        nudgeX.set(nudge.x);
        nudgeY.set(nudge.y);
      },
      onDeactivate: (event) => {
        "worklet";
        if (!event.canceled) {
          toJS(
            step,
            swipeAction({
              dx: event.absoluteX - fromX.value,
              dy: event.absoluteY - fromY.value,
              vx: event.velocityX,
              vy: event.velocityY,
              at: page.value,
              bounds: bounds.value,
            }),
          );
        }
        settle();
      },
    }),
  );

  const nudge = useAnimatedStyle(() => ({
    transform: [{ translateX: nudgeX.value }, { translateY: nudgeY.value }],
  }));

  useSwipeKeys(target, step);

  const keep = (node: SwipePressRef | null) => {
    target.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref != null) {
      ref.current = node;
    }
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={nudge}>
        <Pressable
          ref={keep}
          testID={testID}
          style={({ pressed }) => [style, pressed && pressedStyle]}
          onPress={() => step("press")}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityActions={actions.map((action) => ({
            name: action.name,
            label: action.label,
          }))}
          onAccessibilityAction={(event) => {
            const name = event.nativeEvent.actionName;
            if (isAction(name)) {
              step(name);
            }
          }}
        >
          {children}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
