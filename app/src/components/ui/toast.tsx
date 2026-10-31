import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  colors,
  radiusFloating,
  shadows,
  spacing,
  type,
} from "@/theme/tokens";
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
  return (
    <Overlay layer="toast">
      <View role="alert" aria-live="polite" style={[styles.toast, { bottom }]}>
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
    </Overlay>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.m,
    right: spacing.m,
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
});
