import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Pressable } from "@/components/ui/pressable";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** A property glyph, sized to read beside its label. */
const glyph = 18;

/**
 * The Reference tile: one row for each note the task points at, a press
 * on a row opens the note, and a press on its close detaches that link.
 * The row that adds another sits under them. A link is a note, so it
 * reads with the link glyph and the note's name.
 */
export function ReferenceTile({
  names,
  onOpen,
  onRemove,
  onAdd,
}: {
  names: string[];
  onOpen: (name: string) => void;
  onRemove: (name: string) => void;
  onAdd: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.tile}>
      <View style={styles.head}>
        <Icon name="link" size={glyph} />
        <Text style={styles.title}>Reference</Text>
      </View>
      {names.map((name) => (
        <View key={name} style={styles.row}>
          <Pressable
            style={({ pressed }) => [
              styles.open,
              pressed && styles.pressed,
            ]}
            onPress={() => onOpen(name)}
            accessibilityRole="button"
            accessibilityLabel={`open reference ${name}`}
          >
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
          <IconButton label={`remove reference ${name}`} onPress={() => onRemove(name)}>
            <Icon name="close" />
          </IconButton>
        </View>
      ))}
      <Pressable
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="link a reference"
      >
        <Icon name="plus" size={glyph} color="accent" />
        <Text style={styles.addText}>Link a reference</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    tile: {
      flexBasis: "100%",
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
      paddingTop: spacing.m,
      paddingHorizontal: spacing.m,
      paddingBottom: spacing.s,
      gap: spacing.xs,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    title: {
      ...type.caption,
      fontWeight: "600",
      color: colors.inkMuted,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    open: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
      borderRadius: radius,
      paddingLeft: glyph + spacing.xs,
    },
    name: {
      ...type.control,
      color: colors.ink,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    add: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      minHeight: 44,
      paddingLeft: spacing.xs,
      borderRadius: radius,
    },
    addText: {
      ...type.control,
      color: colors.accent,
    },
  }),
});
