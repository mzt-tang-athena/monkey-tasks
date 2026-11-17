import { StyleSheet, Text, View } from "react-native";
import { MONTHS, WEEKDAYS_FULL } from "@/features/planner/lib/labels";
import { fonts, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The compact day heading: the month and year as an eyebrow, the
    short serif date, and an accent rule under them. */
export function DayHeading({ date, testID }: { date: Date; testID?: string }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View testID={testID} style={styles.heading}>
      <View>
        <Text style={styles.month}>
          {MONTHS[date.getMonth()]} {date.getFullYear()}
        </Text>
        <Text style={styles.date}>
          {WEEKDAYS_FULL[date.getDay()]} {date.getDate()}
        </Text>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    heading: {
      gap: spacing.xs,
    },
    month: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: fonts.body,
      color: colors.inkMuted,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    date: {
      fontSize: 26,
      lineHeight: 32,
      fontFamily: fonts.display,
      color: colors.ink,
    },
    rule: {
      height: 2,
      backgroundColor: colors.accent,
      width: 40,
      borderRadius: 1,
    },
  }),
});
