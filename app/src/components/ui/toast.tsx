import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { measure, radiusFloating, shadows, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { BannerAction } from "./banner";
import { Button } from "./button";
import { Overlay } from "./overlay-host";

/**
 * A banner that floats above the page at `layers.toast`, such as a
 * failed capture. It holds a message and up to two actions: the first
 * reads as the main one, the second as a quiet dismiss. The caller
 * places it with `bottom`, the distance from the window's bottom edge.
 */
export function Toast({
  message,
  actions = [],
  bottom,
}: {
  message: string;
  actions?: [BannerAction] | [BannerAction, BannerAction] | [];
  bottom: number;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Overlay layer="toast">
      <View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
        <View role="alert" aria-live="polite" style={styles.toast}>
          <Text style={styles.message} numberOfLines={3}>
            {message}
          </Text>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              variant="text"
              tone={index === 0 ? "accent" : "muted"}
              label={action.label}
              accessibilityLabel={action.accessibilityLabel}
              onPress={action.onPress}
            />
          ))}
        </View>
      </View>
    </Overlay>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The dock spans the window and centers the toast, which holds to
    // the reading measure (ADR 0010).
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      paddingHorizontal: spacing.m,
      alignItems: "center",
    },
    toast: {
      width: "100%",
      maxWidth: measure,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: radiusFloating,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      ...shadows.floating,
    },
    message: {
      flex: 1,
      ...type.meta,
      color: colors.danger,
    },
  }),
});
