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
import { radii, type Layer } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** A point in window space, the center of the checkbox the user ticked. */
export type CelebrationAt = { x: number; y: number };

/**
 * The surface the tick happened on. A burst from the page draws under
 * every bar and menu. A burst from inside a sheet draws over that
 * sheet, or the panel would hide it as the sheet closes.
 */
export type CelebrationSurface = "page" | "sheet";

const layerOf: Record<CelebrationSurface, Layer> = {
  page: "celebrate",
  sheet: "celebrateSheet",
};

const surfaces = ["page", "sheet"] as const;

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

type Burst = CelebrationAt & { id: number; surface: CelebrationSurface };

type Celebrate = (at: CelebrationAt, surface?: CelebrationSurface) => void;

const CelebrateContext = React.createContext<Celebrate>(() => {});

/**
 * The burst behind one tick control. `ref` goes on the view that draws
 * the circle, and `play` runs at the start of the control's press. It
 * reads the circle's place on screen, and a press that reopens a done
 * task plays nothing. A component with no provider above it, as a unit
 * test renders it, celebrates nothing.
 */
export function useTickBurst(
  done: boolean,
  surface: CelebrationSurface = "page",
): { ref: React.RefObject<React.ComponentRef<typeof View> | null>; play: () => void } {
  const celebrate = React.useContext(CelebrateContext);
  const ref = React.useRef<React.ComponentRef<typeof View>>(null);
  const play = React.useCallback(() => {
    if (done) {
      return;
    }
    ref.current?.measureInWindow((x, y, width, height) => {
      celebrate({ x: x + width / 2, y: y + height / 2 }, surface);
    });
  }, [celebrate, done, surface]);
  return { ref, play };
}

/**
 * Draws each tick's burst above the screen for `motion.ms.celebrate`.
 * It sits under the theme and the overlay host in the root layout, and
 * above every surface that can tick. A burst draws at its surface's
 * layer: under the bars and menus for a page tick, over the sheet for
 * a tick inside one. It takes no press, and with reduced motion it
 * never mounts.
 *
 * It draws outside the row on purpose: a ticked row moves to
 * Completed after the tick's 320 ms (ADR 0034), and a burst inside it
 * would stop there.
 */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  const nextId = React.useRef(1);

  const celebrate = React.useCallback<Celebrate>(
    (at, surface = "page") => {
      if (reduced) {
        return;
      }
      const id = nextId.current++;
      setBursts((current) => [
        ...current.slice(-(maxBursts - 1)),
        { ...at, id, surface },
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
      {surfaces.map((surface) => {
        const here = bursts.filter((burst) => burst.surface === surface);
        if (here.length === 0) {
          return null;
        }
        return (
          <Overlay key={surface} layer={layerOf[surface]}>
            {here.map((burst) => (
              <TickBurst key={burst.id} at={burst} onDone={done} />
            ))}
          </Overlay>
        );
      })}
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
