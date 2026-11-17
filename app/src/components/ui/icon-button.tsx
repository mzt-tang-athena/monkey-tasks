import * as React from "react";
import { StyleSheet } from "react-native";
import { Pressable } from "./pressable";
import { radius, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** A quiet 44pt glyph button. A hover or a press paints its ground; the
    control's selected state lives in the glyph, not the box. */
export function IconButton({
  label,
  expanded,
  onPress,
  children,
}: {
  label: string;
  /** The button opens a menu: whether that menu is showing. */
  expanded?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [hover, setHover] = React.useState(false);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.iconButton,
        (hover || pressed) && styles.iconButtonHot,
      ]}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : "menu"}
    >
      {children}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // Quiet top-right controls: sort glyph and the three-dot overflow.
    iconButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius,
    },
    iconButtonHot: {
      backgroundColor: colors.pressed,
    },
  }),
});
