import * as React from "react";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";
import { colors, radii, spacing, type } from "@/theme/tokens";
import { Button } from "./button";

/** Skeleton line widths: three lines of uneven length. */
const lines: DimensionValue[] = ["40%", "70%", "55%"];

/**
 * The three states a list shows in place of its rows, with one look
 * for every list. Each fills the same block, so a list that moves from
 * loading to empty or to an error keeps its height.
 */

/** The rows are on their way: skeleton lines where they will land. */
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <View
      style={styles.holder}
      role="progressbar"
      aria-label={label}
      aria-busy
    >
      <View style={styles.skeletons}>
        {lines.map((width, index) => (
          <View key={index} style={[styles.skeleton, { width }]} />
        ))}
      </View>
    </View>
  );
}

/** The list holds nothing: one centered line. */
export function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.holder}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** The load failed: the message, and a Retry that runs it again. */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  message: string;
  onRetry: () => void;
  /** The name assistive tech reads for the Retry button. */
  retryLabel?: string;
}) {
  return (
    <View style={styles.holder} role="alert">
      <Text style={styles.label}>{message}</Text>
      <View style={styles.action}>
        <Button label="Retry" accessibilityLabel={retryLabel} onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  holder: {
    minHeight: 160,
    justifyContent: "center",
    gap: spacing.m,
    paddingVertical: spacing.xl,
  },
  skeletons: {
    gap: spacing.xl,
    paddingVertical: spacing.m,
  },
  skeleton: {
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
  },
  label: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
  action: {
    alignItems: "center",
  },
});
