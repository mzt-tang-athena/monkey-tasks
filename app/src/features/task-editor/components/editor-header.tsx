import * as React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { measure, pageGutter, spacing } from "@/theme/tokens";

/**
 * Cancel always. Save only where there is a task to write. The header
 * spans the window, and its row holds to the reading measure, so
 * Cancel and Save sit in the content column.
 */
export function EditorHeader({
  saving = false,
  canSave = false,
  showSave = true,
  onSave,
}: {
  saving?: boolean;
  canSave?: boolean;
  showSave?: boolean;
  onSave?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Button
        variant="text"
        tone="muted"
        label="Cancel"
        accessibilityLabel="cancel editing"
        onPress={() => router.back()}
      />
      <View style={styles.spacer} />
      {showSave ? (
        <Button
          label={saving ? "Saving" : "Save"}
          accessibilityLabel="save task"
          onPress={onSave}
          disabled={saving || !canSave}
          busy={saving}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    maxWidth: measure,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: pageGutter,
    paddingVertical: spacing.m,
    gap: spacing.s,
  },
  spacer: {
    flex: 1,
  },
});
