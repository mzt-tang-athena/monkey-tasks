import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { Pressable } from "@/components/ui/pressable";
import { useVaultFailures } from "@/stores/tasks/use-vault-failures";
import { colors, measure, pageGutter, spacing, type } from "@/theme/tokens";
import type { Repair } from "../hooks/use-list-sections";

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The prompt to pick the vault folder. It shows once the store knows
 * it has no folder, or when the folder stopped reading.
 */
export function VaultPrompt({ onGrant }: { onGrant: () => void }) {
  return (
    <View style={styles.slot}>
      <Pressable
        style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}
        onPress={onGrant}
        accessibilityRole="button"
        accessibilityLabel="connect vault folder"
      >
        <Text style={styles.promptTitle}>Connect your vault folder</Text>
        <Text style={styles.promptHint}>
          Pick the Obsidian vault to use this app with real tasks.
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * The notes that fail validation, with the file and each error, so
 * they can be fixed in the vault. The notice is the list's header, so
 * it scrolls away with the list and never takes room from the rows.
 */
export function RepairNotice({ repairs }: { repairs: Repair[] }) {
  if (repairs.length === 0) {
    return null;
  }
  return (
    <View testID="repair-notice" style={styles.repairs}>
      <Banner tone="danger" title="Needs repair">
        {repairs.map((item) => (
          <View key={item.uri} style={styles.repairItem}>
            <Text style={styles.repairName}>{item.name}.md</Text>
            {item.errors.map((error, index) => (
              <Text key={index} style={styles.repairError}>
                {`• ${error}`}
              </Text>
            ))}
          </View>
        ))}
      </Banner>
    </View>
  );
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
    <View style={[styles.slot, styles.failures]}>
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
  // A fixed notice sits on the page grid above the list.
  slot: {
    maxWidth: measure,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
  },
  failures: {
    gap: spacing.s,
  },
  prompt: {
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  promptTitle: {
    ...type.control,
    color: colors.accent,
    fontWeight: "600",
  },
  promptHint: {
    ...type.meta,
    color: colors.inkMuted,
  },
  // The list header sits on the list's own grid, with a step below it.
  repairs: {
    paddingBottom: spacing.xs,
  },
  repairItem: {
    gap: 2,
  },
  repairName: {
    ...type.control,
    color: colors.ink,
    fontWeight: "600",
  },
  repairError: {
    ...type.meta,
    color: colors.danger,
  },
});
