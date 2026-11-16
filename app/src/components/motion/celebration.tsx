import * as React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Overlay } from "@/components/ui/overlay-host";
import { timing } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { radii } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** A point in window space, the center of the checkbox the user ticked. */
export type CelebrationAt = { x: number; y: number };

/** The most bursts on screen at once, so a fast run of ticks cannot
    pile up nodes. Each one is gone in half a second. */
const maxBursts = 4;

/** Half the burst box, in px. The dots fade before they reach it. */
const reach = 40;

/** The circle the tick draws, at rest. The ring starts here. */
const ringSize = 24;

/**
 * The dots: an angle, a distance and a size. A fixed table keeps a
 * burst identical every time, so a screenshot can be compared and a
 * test never waits on a random draw.
 */
const dots = [
  { degrees: 20, distance: 30, size: 4 },
  { degrees: -35, distance: 26, size: 3 },
  { degrees: 65, distance: 32, size: 3 },
  { degrees: 110, distance: 27, size: 4 },
  { degrees: 155, distance: 30, size: 3 },
  { degrees: -110, distance: 28, size: 4 },
  { degrees: -155, distance: 24, size: 3 },
  { degrees: 200, distance: 31, size: 3 },
].map((dot) => {
  const radians = (dot.degrees * Math.PI) / 180;
  return {
    ...dot,
    dx: Math.cos(radians) * dot.distance,
    dy: Math.sin(radians) * dot.distance,
  };
});

type Burst = CelebrationAt & { id: number };

const CelebrateContext = React.createContext<(at: CelebrationAt) => void>(
  () => {},
);

/**
 * The one way a tick asks for a burst. A component with no provider
 * above it, as a unit test renders it, celebrates nothing.
 */
export function useCelebrate(): (at: CelebrationAt) => void {
  return React.useContext(CelebrateContext);
}

/**
 * Draws each tick's burst above the screen for `motion.ms.celebrate`.
 * It sits under the theme and the overlay host in the root layout.
 * A burst draws at `layers.celebrate`, so it never covers the bottom
 * bar, and it takes no press. With reduced motion it never mounts.
 *
 * It draws outside the row on purpose: a ticked row moves to
 * Completed after the tick's 320 ms (ADR 0034), and a burst inside it
 * would stop there.
 */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  const nextId = React.useRef(1);

  const celebrate = React.useCallback(
    (at: CelebrationAt) => {
      if (reduced) {
        return;
      }
      const id = nextId.current++;
      setBursts((current) => [
        ...current.slice(-(maxBursts - 1)),
        { ...at, id },
      ]);
    },
    [reduced],
  );

  const done = React.useCallback((id: number) => {
    setBursts((current) => current.filter((burst) => burst.id !== id));
  }, []);

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      {bursts.length === 0 ? null : (
        <Overlay layer="celebrate">
          {bursts.map((burst) => (
            <TickBurst key={burst.id} at={burst} onDone={done} />
          ))}
        </Overlay>
      )}
    </CelebrateContext.Provider>
  );
}

/**
 * One burst: a ring that opens from the tick's circle, and eight dots
 * that fly out and fall a little. One shared value drives every part
 * on the UI thread, and the end of the run removes the burst. No timer
 * runs beside it.
 */
function TickBurst({
  at,
  onDone,
}: {
  at: Burst;
  onDone: (id: number) => void;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.set(
      timing(1, motion.ms.celebrate, () => onDone(at.id), Easing.linear),
    );
  }, [progress, onDone, at.id]);

  const ring = useAnimatedStyle(() => {
    const p = progress.value;
    const fade = p < 0.3 ? 0.9 : 0.9 * (1 - (p - 0.3) / 0.6);
    return {
      opacity: Math.max(0, fade),
      transform: [{ scale: 0.7 + 1.7 * (1 - Math.pow(1 - p, 2)) }],
    };
  });

  return (
    <View
      testID="tick-burst"
      pointerEvents="none"
      aria-hidden
      style={[styles.box, { left: at.x - reach, top: at.y - reach }]}
    >
      <Animated.View
        style={[styles.ring, { borderColor: colors.accent }, ring]}
      />
      {dots.map((dot, index) => (
        <Dot
          key={dot.degrees}
          dot={dot}
          progress={progress}
          color={index % 2 === 0 ? colors.accent : colors.accentDeep}
        />
      ))}
    </View>
  );
}

/** One dot on the burst's shared clock. */
function Dot({
  dot,
  progress,
  color,
}: {
  dot: (typeof dots)[number];
  progress: SharedValue<number>;
  color: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const travel = 1 - Math.pow(1 - Math.min(1, p / 0.55), 3);
    const fade = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.4;
    return {
      opacity: Math.max(0, 0.95 * fade),
      transform: [
        { translateX: dot.dx * travel },
        { translateY: dot.dy * travel + 10 * p * p },
        { scale: 0.6 + 0.4 * Math.min(1, p / 0.12) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left: reach - dot.size / 2,
          top: reach - dot.size / 2,
          width: dot.size,
          height: dot.size,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const makeStyles = () => ({
  styles: StyleSheet.create({
    box: {
      position: "absolute",
      width: reach * 2,
      height: reach * 2,
    },
    ring: {
      position: "absolute",
      left: reach - ringSize / 2,
      top: reach - ringSize / 2,
      width: ringSize,
      height: ringSize,
      borderWidth: 2,
      borderRadius: radii.pill,
    },
    dot: {
      position: "absolute",
      borderRadius: radii.pill,
    },
  }),
});
