import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { drag, spacing } from "../../../theme/tokens";
import { SOURCES, sourceLabel, type Mode, type Source } from "../model";
import { styles } from "./plannerStyles";

/**
 * The small source toggle above a mode's bottom list. Quiet at rest:
 * a muted label and a chevron. Pressed, it previews the next source
 * in the cycle. Held past drag.holdMs, it opens the direct chooser
 * menu (rendered by the screen) instead of cycling.
 */
export function SourceToggle({
  source,
  mode,
  menuOpen,
  onCycle,
  onOpenMenu,
}: {
  source: Source;
  mode: Mode;
  menuOpen: boolean;
  onCycle: () => void;
  onOpenMenu: (anchor: { top: number; left: number }) => void;
}) {
  const wrapRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [held, setHeld] = React.useState(false);

  const index = SOURCES.indexOf(source);
  const label = sourceLabel(source, mode);
  const nextLabel = sourceLabel(SOURCES[(index + 1) % SOURCES.length], mode);

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
          styles.sourceToggle,
          (hover || pressed) && styles.sourceToggleHot,
        ]}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        onPressIn={() => {
          setPressed(true);
          setHeld(false);
          holdTimer.current = setTimeout(() => {
            setHeld(true);
            wrapRef.current?.measureInWindow((x, y, width, height) => {
              onOpenMenu({
                top: y + height + 4,
                left: Math.max(x, spacing.m),
              });
            });
          }, drag.holdMs);
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
          onCycle();
        }}
        accessibilityRole="button"
        accessibilityLabel={`task source: ${label}`}
      >
        <Text
          style={[
            styles.sourceToggleText,
            pressed && !held && styles.sourceToggleTextHot,
          ]}
        >
          {pressed && !held ? nextLabel : label}
        </Text>
        <Text style={styles.sourceToggleChevron}>{"▾"}</Text>
      </Pressable>
    </View>
  );
}
