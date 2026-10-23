import * as React from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, radius } from "../../theme/tokens";

/** A quiet 36pt glyph button: hover, pressed, and active states. */
export function IconButton({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.iconButton,
        (hover || pressed) && styles.iconButtonHot,
        active && styles.iconButtonActive,
      ]}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Quiet top-right controls: sort glyph and the three-dot overflow.
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  iconButtonHot: {
    backgroundColor: colors.pressed,
  },
  iconButtonActive: {
    backgroundColor: colors.accentSoft,
  },
});
