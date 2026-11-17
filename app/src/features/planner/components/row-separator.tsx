import { StyleSheet, View } from "react-native";
import { type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The hairline between rows. The list owns it as its separator slot,
    and the overdue group draws the same one. */
export function RowSeparator() {
  const { styles } = useThemedStyles(makeStyles);
  return <View testID="row-separator" style={styles.line} />;
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    line: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
  }),
});
