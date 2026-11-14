import { StyleSheet, Text, View } from "react-native";
import { journal, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { dayParts } from "../lib/labels";

/**
 * The day the page belongs to: the month as an eyebrow, the serif date,
 * and the accent rule the planner's day heading uses. The heading sits
 * above the ruled page, not on it. Each of its parts holds a whole
 * number of `journal.line`s, so the page's first rule still starts on
 * the grid.
 */
export function JournalHeading({ day }: { day: string }) {
  const { styles } = useThemedStyles(makeStyles);
  const parts = dayParts(day);
  return (
    <View style={styles.heading}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.month}>{parts.month}</Text>
      </View>
      <View style={styles.dateRow}>
        <Text style={styles.date}>{parts.date}</Text>
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
      height: journal.line * 4,
    },
    eyebrowRow: {
      height: journal.line,
      justifyContent: "center",
    },
    dateRow: {
      height: journal.line * 2,
      justifyContent: "center",
    },
    ruleRow: {
      height: journal.line,
      justifyContent: "center",
    },
    month: {
      ...type.caption,
      color: colors.inkMuted,
      textTransform: "uppercase",
      letterSpacing: 1.5,
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
