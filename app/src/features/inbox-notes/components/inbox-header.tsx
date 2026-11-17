import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { pageGutter, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The screen's name and the number of notes the cards show. */
export function InboxHeader({ count }: { count: number }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Inbox Notes</Text>
      <Text style={styles.count}>
        {count === 1 ? "1 note" : `${count} notes`}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.s,
      paddingHorizontal: pageGutter,
      paddingTop: spacing.m,
      paddingBottom: spacing.s,
    },
    title: {
      ...type.title,
      fontWeight: "600",
      color: colors.ink,
    },
    count: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
