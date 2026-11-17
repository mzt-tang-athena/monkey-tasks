import * as React from "react";
import { StyleSheet, Text } from "react-native";
import type { InboxNote } from "@/lib/inbox-notes/model";
import { PREVIEW_LINES } from "@/lib/inbox-notes/model";
import { Pressable } from "@/components/ui/pressable";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * One note in the grid: its title and its content preview. The title
 * is the note's name, and the preview is enough to know what the note
 * is without opening it. The card's name for assistive tech carries
 * both, because the preview is the point of the card.
 */
export const NoteCard = React.memo(function NoteCard({
  note,
  onPress,
}: {
  note: InboxNote;
  onPress: (note: InboxNote) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const name = note.preview === "" ? note.title : `${note.title}. ${note.preview}`;
  return (
    <Pressable
      testID={`note-card:${note.fileName}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(note)}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint="opens the note"
    >
      <Text style={styles.title} numberOfLines={3}>
        {note.title}
      </Text>
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
    title: {
      ...type.control,
      fontWeight: "600",
      color: colors.ink,
    },
    preview: {
      ...type.meta,
      color: colors.inkMuted,
    },
  }),
});
