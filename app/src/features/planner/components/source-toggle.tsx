import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { motion } from "@/lib/motion/tokens";
import { colors, fonts, radius, spacing } from "@/theme/tokens";
import {
  nextSource,
  sourceLabel,
  type Mode,
} from "@/features/planner/model";
import { usePlannerList } from "./planner-list-context";

/**
 * The small source toggle above a mode's bottom list. Quiet at rest:
 * a muted label and a chevron. Pressed, it previews the next source
 * in the cycle. Held past motion.ms.longPress, it opens the direct chooser
 * menu (rendered by the screen) instead of cycling. The label names the
 * period on screen: "Due today", "Due 8 to 14 Nov", "Due November".
 */
export function SourceToggle({ mode, day }: { mode: Mode; day: Date }) {
  const { today, source, menuOpen, cycleSource, openSourceMenu } =
    usePlannerList();
  const wrapRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [held, setHeld] = React.useState(false);

  const label = sourceLabel(source, mode, day, today);
  const nextLabel = sourceLabel(nextSource(source), mode, day, today);

  React.useEffect(
    () => () => {
      if (holdTimer.current != null) {
        clearTimeout(holdTimer.current);
      }
    },
    [],
  );

  return (
    <View ref={wrapRef}>
      <Pressable
        style={({ pressed }) => [
          styles.toggle,
          (hover || pressed) && styles.hot,
        ]}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        onPressIn={() => {
          setPressed(true);
          setHeld(false);
          holdTimer.current = setTimeout(() => {
            setHeld(true);
            openSourceMenu(wrapRef);
          }, motion.ms.longPress);
        }}
        onPressOut={() => {
          setPressed(false);
          if (holdTimer.current != null) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
          }
        }}
        // Tap cycles; a press that opened the chooser must not. The
        // preview ends with the action, not with the press-out: on
        // Android a short tap calls onPress before the press-out it
        // delays to its minimum press duration, so a still-pressed
        // chip would render the source AFTER the one this tap chose -
        // Due today would read Main right after landing on Focus.
        onPress={() => {
          setPressed(false);
          if (held || menuOpen) {
            return;
          }
          cycleSource();
        }}
        accessibilityRole="button"
        accessibilityLabel={`task source: ${label}`}
      >
        <Text style={[styles.text, pressed && !held && styles.textHot]}>
          {pressed && !held ? nextLabel : label}
        </Text>
        <Icon name="chevron-down" color="inkFaint" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    minHeight: 32,
    paddingLeft: spacing.s,
    paddingRight: spacing.s,
    borderRadius: radius,
  },
  hot: {
    backgroundColor: colors.pressed,
  },
  // The label slot reserves the widest source's width, so the control
  // never resizes mid-press: the pressed preview must not move the box
  // out from under the pointer.
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
    minWidth: 96,
  },
  textHot: {
    color: colors.accent,
  },
});
