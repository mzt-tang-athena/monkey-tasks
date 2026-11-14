import * as React from "react";
import { StyleSheet, View } from "react-native";
import { journal, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * The page's ruled lines, drawn behind the text at `journal.line`
 * intervals. One rule per visual line, including the wrapped ones,
 * which is the whole point: text at the same `lineHeight` with no
 * vertical padding lands on these rules whatever it wraps to.
 *
 * It fills its parent, so the rules run past the last entry to the
 * bottom of the page, as ruled paper does.
 */
export function PaperRules({ height }: { height: number }) {
  const { styles } = useThemedStyles(makeStyles);
  const count = Math.min(
    Math.max(0, Math.ceil(height / journal.line)),
    journal.maxRules,
  );
  return (
    <View pointerEvents="none" aria-hidden style={styles.rules}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.rule,
            { top: (index + 1) * journal.line - StyleSheet.hairlineWidth },
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    rules: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden",
    },
    rule: {
      position: "absolute",
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.hairline,
    },
  }),
});
