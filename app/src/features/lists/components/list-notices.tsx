import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { useVaultFailures } from "@/stores/tasks/use-vault-failures";
import { measure, pageGutter, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { Repair } from "../hooks/use-list-sections";

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The notes that fail validation, with the file and each error, so
 * they can be fixed in the vault. The notice is the list's header, so
 * it scrolls away with the list and never takes room from the rows.
 */
export function RepairNotice({ repairs }: { repairs: Repair[] }) {
  const { styles } = useThemedStyles(makeStyles);
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
  const { styles } = useThemedStyles(makeStyles);
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

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
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
  }),
});
