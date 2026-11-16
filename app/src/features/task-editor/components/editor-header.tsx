import * as React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { measure, pageGutter, spacing } from "@/theme/tokens";

/**
 * The read-only note screen's header: one Close. A task has no screen
 * of its own any more, so this header carries no Save (ADR
 * 20261116-task-editor-sheet). The header spans the window, and its row
 * holds to the reading measure, so Close sits in the content column.
 */
export function EditorHeader() {
  return (
    <View style={styles.row}>
      <Button
        variant="text"
        tone="muted"
        label="Close"
        accessibilityLabel="close note"
        onPress={() => router.back()}
      />
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
});
