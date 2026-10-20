import * as React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../theme/tokens";

/** Floating capture button, variant A: one blue disc, bottom right. */
export function FloatingCaptureButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel="add a task"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.plus}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.fab,
    bottom: theme.spacing[5],
    elevation: 6,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    right: theme.spacing[5],
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    width: 56,
  },
  buttonPressed: {
    backgroundColor: theme.colors.accentPressed,
    transform: [{ scale: 0.96 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  plus: {
    color: theme.colors.onAccent,
    fontSize: 28,
    fontWeight: theme.weights.regular,
    lineHeight: 32,
  },
});
