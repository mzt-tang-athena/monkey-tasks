import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "./pressable";
import { measure, pageGutter, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * The prompt to pick the vault folder. It shows once the app knows it
 * has no folder, or when the folder stopped reading.
 *
 * Every screen that reads the vault offers it, so it lives in shared
 * code. The hint names what the folder is for on that screen.
 */
export function VaultPrompt({
  onGrant,
  hint = "Pick the Obsidian vault to use this app with real tasks.",
}: {
  onGrant: () => void;
  hint?: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.slot}>
      <Pressable
        style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}
        onPress={onGrant}
        accessibilityRole="button"
        accessibilityLabel="connect vault folder"
      >
        <Text style={styles.title}>Connect your vault folder</Text>
        <Text style={styles.hint}>{hint}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    slot: {
      maxWidth: measure,
      alignSelf: "center",
      width: "100%",
      paddingHorizontal: pageGutter,
      paddingTop: spacing.m,
    },
    prompt: {
      gap: 2,
    },
    pressed: {
      opacity: 0.7,
    },
    title: {
      ...type.control,
      color: colors.accent,
      fontWeight: "600",
    },
    hint: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
