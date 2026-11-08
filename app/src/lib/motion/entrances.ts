import { Keyframe, ReduceMotion } from "react-native-reanimated";
import { motion } from "./tokens";

const landed = new Set<string>();

/** Marks a row that the user just made, so the row that mounts under
    `id` plays its landing. */
export function markLanded(id: string): void {
  landed.add(id);
}

/** Whether `id` carries a landing mark. The mark goes with the answer,
    so a remount under the same id finds nothing. */
export function takeLanded(id: string): boolean {
  return landed.delete(id);
}

/** The corner a menu grows from: the one next to its anchor. */
export type MenuCorner = `${"top" | "bottom"} ${"left" | "right"}`;

/** Scaling to 0.92 about the centre moves each corner in by 4% of the
    box. The start frame shifts the box by that much toward `corner`, so
    the corner holds still while the menu grows. */
const shrink = 0.92;
const shift = "4%";
const back = "-4%";

/** A menu's entrance: it fades in and grows from its anchor corner. */
export function menuEntering(corner: MenuCorner) {
  const [vertical, horizontal] = corner.split(" ");
  return new Keyframe({
    0: {
      opacity: 0,
      transform: [
        { translateX: horizontal === "right" ? shift : back },
        { translateY: vertical === "bottom" ? shift : back },
        { scale: shrink },
      ],
    },
    100: {
      opacity: 1,
      transform: [{ translateX: "0%" }, { translateY: "0%" }, { scale: 1 }],
      easing: motion.easeOut,
    },
  })
    .duration(motion.ms.menu)
    .reduceMotion(ReduceMotion.System);
}
