import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { pageGutter, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * The number of notes the cards show. The screen draws no title, so
 * this line is also its heading: a screen reader says "Inbox Notes"
 * first, then the count.
 */
export function InboxHeader({ count }: { count: number }) {
  const { styles } = useThemedStyles(makeStyles);
  const label = count === 1 ? "1 note" : `${count} notes`;
  return (
    <View testID="inbox-header" style={styles.header}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={`Inbox Notes, ${label}`}
        style={styles.count}
      >
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    header: {
      paddingHorizontal: pageGutter,
      paddingTop: spacing.m,
      paddingBottom: spacing.s,
    },
    count: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
