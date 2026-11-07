import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/tokens";

/** The hairline between rows. The list owns it as its separator slot,
    and the overdue group draws the same one. */
export function RowSeparator() {
  return <View testID="row-separator" style={styles.line} />;
}

const styles = StyleSheet.create({
  line: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
