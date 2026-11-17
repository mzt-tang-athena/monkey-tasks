import { StyleSheet, Text, View } from "react-native";
import { journal, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { dayParts } from "../lib/labels";

/**
 * The day the page belongs to: the serif date and the accent rule. The
 * month sits in the header. The day is the page's title, so it scrolls
 * with the writing rather than sitting in the chrome.
 *
 * Each part holds a whole number of `journal.line`s, so the page's first
 * rule still starts on the grid.
 */
export function JournalHeading({ day }: { day: string }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.heading}>
      <View style={styles.dateRow}>
        <Text style={styles.date} accessibilityRole="header">
          {dayParts(day).date}
        </Text>
      </View>
      <View style={styles.ruleRow}>
        <View style={styles.rule} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    heading: {
      height: journal.line * 3,
    },
    dateRow: {
      height: journal.line * 2,
      justifyContent: "center",
    },
    ruleRow: {
      height: journal.line,
      justifyContent: "center",
    },
    date: {
      ...type.display,
      color: colors.ink,
    },
    rule: {
      height: 2,
      width: 40,
      borderRadius: 1,
      backgroundColor: colors.accent,
    },
  }),
});
