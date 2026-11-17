import { StyleSheet, Text, View } from "react-native";
import { measure, pageGutter, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { dayParts, foodName } from "../lib/labels";

/**
 * The tab's fixed header: the month on the left, today's food count on
 * the right. The day itself is the page's title, below the header, so
 * the serif date keeps its size.
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
  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <Text style={styles.month}>{dayParts(day).month}</Text>
        <View
          style={styles.stats}
          testID="food-stat"
          role="group"
          aria-label={foodName(foodCount)}
        >
          <Text style={styles.statLabel}>Food</Text>
          <Text style={[styles.statValue, foodCount === 0 && styles.statZero]}>
            {foodCount}
          </Text>
        </View>
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.m,
      paddingHorizontal: pageGutter,
      paddingVertical: spacing.m,
    },
    month: {
      ...type.caption,
      color: colors.inkMuted,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    stats: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
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
  }),
});
