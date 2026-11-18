import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { InboxNote } from "@/lib/inbox-notes/model";
import { PREVIEW_LINES } from "@/lib/inbox-notes/model";
import { Pressable } from "@/components/ui/pressable";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * The title split at its hyphens, with each hyphen ending its run. The
 * runs join back to the exact name, so this only tells the layout where
 * a line may break: after a hyphen, never inside a word. A run wider
 * than the card still wraps inside itself.
 */
export function titleRuns(title: string): string[] {
  const runs: string[] = [];
  let start = 0;
  for (;;) {
    const hyphen = title.indexOf("-", start);
    if (hyphen === -1) {
      break;
    }
    runs.push(title.slice(start, hyphen + 1));
    start = hyphen + 1;
  }
  runs.push(title.slice(start));
  const named = runs.filter((run) => run !== "");
  return named.length === 0 ? [title] : named;
}

/**
 * One note in the grid: its title and its content preview. The title
 * is the note's name, and the preview is enough to know what the note
 * is without opening it. The card takes its accessible name from the
 * text it shows, so a screen reader and the eye read the same words.
 */
export const NoteCard = React.memo(function NoteCard({
  note,
  onPress,
}: {
  note: InboxNote;
  onPress: (note: InboxNote) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      testID={`note-card:${note.fileName}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(note)}
      accessibilityRole="button"
      accessibilityHint="opens the note"
    >
      <View testID="note-title" style={styles.titleWrap}>
        {titleRuns(note.title).map((run, at) => (
          <Text key={at} style={styles.title}>
            {run}
          </Text>
        ))}
      </View>
      {note.preview === "" ? null : (
        <Text style={styles.preview} numberOfLines={PREVIEW_LINES}>
          {note.preview}
        </Text>
      )}
    </Pressable>
  );
});

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
      padding: spacing.m,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    titleWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    title: {
      ...type.control,
      fontWeight: "600",
      color: colors.ink,
      flexShrink: 1,
      maxWidth: "100%",
    },
    preview: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
