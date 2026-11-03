import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { useVaultFailures } from "@/stores/tasks/use-vault-failures";
import { measure, pageGutter, spacing } from "@/theme/tokens";

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The vault writes that failed, one banner each, above the list. The
 * list stays usable. A failure keeps its banner until the user retries
 * or dismisses it, so a later success never hides it. A notice is a
 * write that landed with something to say, such as an untick that
 * kept an edited next occurrence.
 */
export function FailureBanner() {
  const failures = useVaultFailures();
  if (failures.length === 0) {
    return null;
  }
  return (
    <View style={styles.slot}>
      {failures.map((entry) =>
        entry.kind === "failure" ? (
          <Banner
            key={entry.key}
            tone="danger"
            title={`${entry.label} not saved`}
            lines={[sentence(entry.message)]}
            actions={[
              {
                label: "Retry",
                accessibilityLabel: `retry ${entry.label}`,
                onPress: entry.retry,
              },
              {
                label: "Dismiss",
                accessibilityLabel: "dismiss error",
                onPress: entry.dismiss,
              },
            ]}
          />
        ) : (
          <Banner
            key={entry.key}
            tone="info"
            lines={[sentence(entry.message)]}
            actions={[
              {
                label: "Dismiss",
                accessibilityLabel: "dismiss notice",
                onPress: entry.dismiss,
              },
            ]}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // On the page grid, above the list, like the repair notice.
  slot: {
    maxWidth: measure,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
    gap: spacing.s,
  },
});
