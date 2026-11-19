import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useCommandPane } from "@/hooks/use-command-pane";
import { bottomBar, radii, touchTarget, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * The bar's action: the tab's Add action and the command pane's opener,
 * one pill with a hairline between them. Both halves are 44pt squares,
 * so the pill is about 89pt wide and four tabs still fit a 360pt
 * screen. Each half is its own button with its own name, so a keyboard
 * and TalkBack reach Add and the pane separately. The pane's half is
 * part of the bar, so every tab carries the opener.
 */
export type SplitAddPillRef = React.ComponentRef<typeof Pressable>;

export function SplitAddPill({
  label,
  onPress,
  ref,
}: {
  /** The Add half's accessible name, such as "add task". */
  label: string;
  onPress: () => void;
  ref?: React.Ref<SplitAddPillRef>;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { show } = useCommandPane();
  return (
    <View style={styles.pill}>
      <Pressable
        ref={ref}
        style={({ pressed }) => [styles.half, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name="plus" color="onAccent" />
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        style={({ pressed }) => [styles.half, pressed && styles.pressed]}
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel="open commands"
      >
        <Icon name="command" color="onAccent" />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      height: bottomBar.add,
      borderRadius: radii.pill,
      backgroundColor: colors.accent,
      overflow: "hidden",
    },
    // Each half is its own 44pt target.
    half: {
      width: touchTarget,
      height: touchTarget,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      backgroundColor: colors.accentDeep,
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      backgroundColor: colors.accentDeep,
    },
  }),
});
