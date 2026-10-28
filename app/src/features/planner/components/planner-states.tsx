import { Pressable, Text, View } from "react-native";
import { styles } from "./planner-styles";

/** The store is still loading: skeleton rows where the list lands. */
export function LoadingState() {
  return (
    <View style={styles.holder}>
      <View style={[styles.skeleton, { width: "60%" as const, height: 28 }]} />
      <View style={[styles.skeleton, { width: "85%" as const }]} />
      <View style={[styles.skeleton, { width: "70%" as const }]} />
    </View>
  );
}

/** The load failed. The button runs the same load again, so the
    screen never asks for a pull gesture it does not have. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.holder}>
      <Text style={styles.empty}>Something went wrong.</Text>
      <Pressable
        style={({ pressed }) => [
          styles.retry,
          pressed && styles.retryPressed,
        ]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading tasks"
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}
