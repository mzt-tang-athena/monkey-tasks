import { StyleSheet, Text, View } from "react-native";
import { measure, pageGutter, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { dayParts, foodName } from "../lib/labels";

/**
 * The tab's fixed header: the day on the left, today's food count on the
 * right. The page scrolls under it, so the date stays in view while the
 * writing moves past.
 *
 * The count is the first of the numbers this band will hold. Calories
 * from the reference notes join it later. The food labels stay on the
 * page, because repeating them here says nothing new.
 */
export function JournalHeader({
  day,
  foodCount,
}: {
  /** `YYYY-MM-DD`. */
  day: string;
  /** Today's food bullets. */
  foodCount: number;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const parts = dayParts(day);
  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <View style={styles.row}>
          <View style={styles.dateBlock}>
            <Text style={styles.month}>{parts.month}</Text>
            <Text style={styles.date} accessibilityRole="header">
              {parts.date}
            </Text>
          </View>
          <View
            style={styles.stats}
            testID="food-stat"
            role="group"
            aria-label={foodName(foodCount)}
          >
            <Text style={styles.statLabel}>Food</Text>
            <Text
              style={[styles.statValue, foodCount === 0 && styles.statZero]}
            >
              {foodCount}
            </Text>
          </View>
        </View>
        <View style={styles.rule} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The header takes the surface the status strip shares, so the top
    // chrome reads as one band above the paper.
    header: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    inner: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: pageGutter,
      paddingTop: spacing.s,
      paddingBottom: spacing.m,
      gap: spacing.s,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.m,
    },
    dateBlock: {
      gap: spacing.xs,
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
    stats: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingBottom: 2,
    },
    statLabel: {
      ...type.eyebrow,
      color: colors.inkMuted,
    },
    statValue: {
      ...type.meta,
      color: colors.ink,
      fontVariant: ["tabular-nums"],
    },
    statZero: {
      color: colors.inkMuted,
    },
    rule: {
      height: 2,
      width: 40,
      borderRadius: 1,
      backgroundColor: colors.accent,
    },
  }),
});
