import * as React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

export function FloatingCaptureButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityLabel="add a task">
      <Text style={styles.plus}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1d3fbf",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  plus: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "400",
  },
});
