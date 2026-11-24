import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { PickerSheet } from "@/components/ui/picker-sheet";
import { Pressable } from "@/components/ui/pressable";
import { TextField } from "@/components/ui/text-field";
import { searchReferences } from "@/lib/references/search";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { ReferenceNote } from "@/types/reference";

/** The words a row shows under the name: its categories and types. */
export function referenceWords(note: ReferenceNote): string {
  return [...note.categories, ...note.types].join(" · ");
}

/** The row's name for assistive tech: the note, its categories, its types. */
export function referenceLabel(note: ReferenceNote): string {
  return [note.name, ...note.categories, ...note.types].join(", ");
}

/**
 * The Reference picker: a stacked sheet that searches the References
 * folder by note name or by an ingredient. A finger that does not want
 * to type opens the folder as a list instead. A press attaches the note
 * and keeps the sheet open, so a task can point at more than one.
 */
export function ReferencePicker({
  open,
  onClose,
  notes,
  attached,
  onAttach,
  error = null,
}: {
  open: boolean;
  onClose: () => void;
  /** The folder's notes, or null while the first read runs. */
  notes: ReferenceNote[] | null;
  /** The names the task already points at. */
  attached: string[];
  onAttach: (name: string) => void;
  error?: string | null;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [query, setQuery] = React.useState("");
  const [browsing, setBrowsing] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setBrowsing(false);
    }
  }

  const searching = query.trim() !== "";
  const rows =
    notes == null
      ? []
      : searching
        ? searchReferences(notes, query)
        : browsing
          ? notes
          : [];

  const empty =
    error ??
    (notes == null
      ? "Reading the References folder."
      : searching
        ? "No note matches that name or ingredient."
        : "Type a name or an ingredient, or browse the folder.");

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title="Reference"
      doneLabel="Done"
      onDone={onClose}
    >
      <TextField
        label="Find a reference"
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or ingredient"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      {notes != null && !searching ? (
        <Pressable
          style={({ pressed }) => [styles.browse, pressed && styles.pressed]}
          onPress={() => setBrowsing((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={
            browsing ? "search by name" : "browse the References folder"
          }
          aria-pressed={browsing}
        >
          <Icon name="list" size={18} color="accent" />
          <Text style={styles.browseText}>
            {browsing ? "Search by name" : "Browse the References folder"}
          </Text>
        </Pressable>
      ) : null}
      {rows.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        <View style={styles.rows}>
          {rows.map((note) => {
            const picked = attached.includes(note.name);
            const words = referenceWords(note);
            return (
              <Pressable
                key={note.name}
                testID={`reference-row:${note.name}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => onAttach(note.name)}
                accessibilityRole="button"
                accessibilityLabel={referenceLabel(note)}
                aria-pressed={picked}
              >
                <View style={styles.rowText}>
                  <Text style={styles.name}>{note.name}</Text>
                  {words === "" ? null : (
                    <Text style={styles.words}>{words}</Text>
                  )}
                </View>
                {picked ? <Icon name="check" color="accent" /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </PickerSheet>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    browse: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingHorizontal: spacing.m,
      borderRadius: radius,
    },
    browseText: {
      ...type.control,
      color: colors.accent,
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
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.m,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...type.body,
      color: colors.ink,
    },
    words: {
      ...type.caption,
      color: colors.inkMuted,
    },
  }),
});
