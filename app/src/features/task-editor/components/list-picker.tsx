import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { TextField } from "@/components/ui/text-field";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** The choice that removes the list: the task files under Main. */
export const MAIN = "Main";

/**
 * The List picker: one list, searchable. Main is the empty choice. A
 * name that matches no list note is not offered, because the app
 * builds the tabs from the notes.
 */
export function ListPicker({
  lists,
  current,
  onPick,
  onClose,
}: {
  /** The list notes, by name. */
  lists: string[];
  /** The task's list, or null for Main. */
  current: string | null;
  onPick: (list: string | null) => void;
  onClose: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [query, setQuery] = React.useState("");
  const wanted = query.trim().toLowerCase();
  const choices = [MAIN, ...lists].filter(
    (name) => wanted === "" || name.toLowerCase().includes(wanted),
  );
  const pick = (name: string) => {
    onPick(name === MAIN ? null : name);
    onClose();
  };
  return (
    <View style={styles.body}>
      <TextField
        label="Find a list"
        value={query}
        onChangeText={setQuery}
        placeholder="Search lists"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      {choices.length === 0 ? (
        <Text style={styles.empty}>No list matches that name.</Text>
      ) : (
        <View style={styles.rows}>
          {choices.map((name) => {
            const chosen = (current ?? MAIN) === name;
            return (
              <Pressable
                key={name}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => pick(name)}
                accessibilityRole="button"
                accessibilityLabel={name}
                aria-pressed={chosen}
              >
                <Icon name="list" color={chosen ? "accent" : "inkMuted"} />
                <Text style={[styles.name, chosen && styles.nameChosen]}>{name}</Text>
                {chosen ? <Icon name="check" color="accent" /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    body: {
      gap: spacing.m,
    },
    empty: {
      ...type.meta,
      color: colors.inkMuted,
    },
    rows: {
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.m,
      minHeight: 48,
      paddingHorizontal: spacing.m,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    name: {
      flex: 1,
      ...type.body,
      color: colors.ink,
    },
    nameChosen: {
      fontWeight: "600",
      color: colors.accent,
    },
  }),
});
