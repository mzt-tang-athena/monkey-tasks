import { StyleSheet, Text, View } from "react-native";
import type { FoodLine } from "@/lib/journal/format";
import { journal, measure, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { foodLine, foodName } from "../lib/labels";

/**
 * The quiet Food band above the bottom bar: the count, then today's
 * food labels newest last on one line. It reads the same parsed page as
 * the journal, so it holds no state and needs no update after a send.
 *
 * It renders on every day, so later stats in its place cause no layout
 * jump. A long day ellipsizes instead of growing the band.
 */
export function FoodStrip({ food }: { food: FoodLine[] }) {
  const { styles } = useThemedStyles(makeStyles);
  const labels = food.map((line) => line.label);
  return (
    <View
      style={styles.strip}
      testID="food-strip"
      role="group"
      aria-label={foodName(labels)}
    >
      <View style={styles.band}>
        <Text style={styles.heading}>Food</Text>
        {food.length === 0 ? null : (
          <Text style={styles.count}>{food.length}</Text>
        )}
        <Text style={styles.list} numberOfLines={1}>
          {foodLine(labels)}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The surface spans the window; the band holds to the reading
    // measure, as the bottom bar's row does.
    strip: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      minHeight: journal.line + spacing.s * 2,
      justifyContent: "center",
    },
    band: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    heading: {
      ...type.eyebrow,
      color: colors.inkMuted,
    },
    count: {
      ...type.meta,
      color: colors.ink,
      fontVariant: ["tabular-nums"],
    },
    list: {
      ...type.meta,
      flex: 1,
      color: colors.inkMuted,
    },
  }),
});
