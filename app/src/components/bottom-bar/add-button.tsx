import * as React from "react";
import { StyleSheet, Text } from "react-native";
import { useBar } from "@/components/bottom-bar/bottom-bar";
import { SwipePress, type SwipePressRef } from "@/components/motion/swipe-press";
import { Icon } from "@/components/ui/icon";
import { useCommandPane } from "@/hooks/use-command-pane";
import type { SwipeAction } from "@/lib/motion/swipe-press";
import {
  bottomBar,
  fonts,
  radii,
  spacing,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

export type AddButtonRef = SwipePressRef;

/**
 * The bar's action: one wide Add button with the glyph and the word.
 * A tap runs the tab's own Add. A swipe down opens the command pane,
 * and a swipe left or right moves one tab, so the button carries the
 * pane and the tabs as well as the capture.
 *
 * The three jobs sit on the button as custom actions for TalkBack and
 * on the arrow keys, so a keyboard or a screen reader reaches what the
 * finger swipes. The bar's nav carries the same tabs, and its empty
 * middle carries nothing.
 */
export function AddButton({
  label,
  onPress,
  ref,
}: {
  /** The button's accessible name, such as "add task". */
  label: string;
  onPress: () => void;
  ref?: React.Ref<AddButtonRef>;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { show } = useCommandPane();
  const bar = useBar();
  const { stepTab } = bar;

  const step = React.useCallback(
    (action: Exclude<SwipeAction, "none">) => {
      if (action === "commands") {
        show();
      } else if (action === "next") {
        stepTab(1);
      } else if (action === "previous") {
        stepTab(-1);
      } else {
        onPress();
      }
    },
    [show, stepTab, onPress],
  );

  return (
    <SwipePress
      ref={ref}
      testID="add-button"
      label={label}
      at={bar.tab}
      count={bar.tabs}
      onStep={step}
      style={styles.button}
      pressedStyle={styles.pressed}
    >
      <Icon name="plus" color="onAccent" />
      <Text style={styles.label}>Add</Text>
    </SwipePress>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // An unmistakable button: glyph and label optically centered on one
    // line, and the height the row gives the nav.
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.s,
      minHeight: bottomBar.add,
      paddingHorizontal: spacing.l,
      borderRadius: radii.pill,
      backgroundColor: colors.accent,
      overflow: "hidden",
    },
    pressed: {
      backgroundColor: colors.accentDeep,
    },
    label: {
      color: colors.onAccent,
      fontSize: bottomBar.addLabelSize,
      lineHeight: bottomBar.addLabelLine,
      fontFamily: fonts.body,
      fontWeight: "600",
    },
  }),
});
