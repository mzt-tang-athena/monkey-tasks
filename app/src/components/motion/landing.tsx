import * as React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { takeLanded } from "@/lib/motion/entrances";
import { motion } from "@/lib/motion/tokens";
import { type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** How far a new row travels as it lands, unless the caller says. */
const landingPx = 12;

function riseBy(px: number, delay = 0) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: px }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: motion.easeOut },
  })
    .delay(delay)
    .duration(motion.ms.landing)
    .reduceMotion(ReduceMotion.System);
}

const landing = riseBy(landingPx);

/**
 * A row that the user just made rises into place, and a wash crosses
 * it once. It plays only when `id` carries a landing mark
 * (`markLanded`). It takes the mark at its first render, so a remount
 * under the same id finds nothing.
 *
 * `rise` sets the travel in points, and `wash={false}` keeps only the
 * rise. The journal uses both: a sent entry rises two ruled lines onto
 * the page and nothing is painted over it. `delay` holds the row off
 * the page until the surface that covered it has left, so the rise is
 * seen rather than played behind a closing sheet. Reduced motion keeps
 * no wait either: the row is simply there.
 */
export function Landing({
  id,
  rise = landingPx,
  wash: washes = true,
  delay = 0,
  children,
}: {
  id: string;
  rise?: number;
  wash?: boolean;
  /** Points to hold the row before it rises. */
  delay?: number;
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const [landed] = React.useState(() => takeLanded(id));
  const [entering] = React.useState(() =>
    rise === landingPx && delay === 0 ? landing : riseBy(rise, reduced ? 0 : delay),
  );
  const wash = useSharedValue(landed && washes ? 0.9 : 0);
  React.useEffect(() => {
    if (landed && washes) {
      const fade = {
        duration: motion.ms.landWash,
        easing: motion.easeOut,
        reduceMotion: ReduceMotion.System,
      };
      wash.set(withTiming(0, fade));
    }
  }, [landed, washes, wash]);
  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value }));
  return (
    <Animated.View entering={landed ? entering : undefined}>
      {washes ? (
        <Animated.View pointerEvents="none" style={[styles.wash, washStyle]} />
      ) : null}
      {children}
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    wash: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.accentSoft,
    },
  }),
});
