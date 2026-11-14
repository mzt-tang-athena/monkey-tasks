import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  entrySegments,
  type JournalEntry,
} from "@/lib/journal/format";
import { journal, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { LinkedText } from "./linked-text";

/**
 * One ruled line: the block's time in the left rail, the bullet's text
 * beside it. The time shows once, on the block's first line; the rest of
 * the block leaves the rail empty, as a journalled page does.
 *
 * Every vertical value here is `journal.line`, and the row takes no
 * vertical padding, because the rules behind are drawn at that rhythm.
 * A wrapped bullet then lands on the rules.
 */
export function EntryRow({
  blockTime,
  entry,
  onReference,
}: {
  /** The block's time on its first row, null on later rows. */
  blockTime: string | null;
  /** Null for a time line that owns no bullets. */
  entry: JournalEntry | null;
  onReference: (name: string) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const segments = React.useMemo(
    () => (entry == null ? [] : entrySegments(entry)),
    [entry],
  );
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {blockTime == null ? null : <Text style={styles.time}>{blockTime}</Text>}
      </View>
      <View style={styles.gutter} />
      <View style={styles.line}>
        {entry == null ? null : (
          <LinkedText
            segments={segments}
            style={styles.body}
            testID={`journal-entry:${entry.id}`}
            onReference={onReference}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.s,
      minHeight: journal.line,
    },
    rail: {
      width: journal.rail,
    },
    // The notebook margin's room. The hairline itself runs the paper's
    // whole height (see `journal-paper`), so it never breaks between
    // rows.
    gutter: {
      width: StyleSheet.hairlineWidth,
    },
    // The rail and the body share one line box, so the time sits on the
    // same rule as the first line of the bullet.
    time: {
      ...type.meta,
      lineHeight: journal.line,
      color: colors.inkMuted,
      fontVariant: ["tabular-nums"],
      textAlign: "right",
    },
    line: {
      flex: 1,
    },
    body: {
      ...type.body,
      lineHeight: journal.line,
      color: colors.ink,
    },
  }),
});
