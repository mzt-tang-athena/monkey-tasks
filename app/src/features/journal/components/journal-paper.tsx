import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Landing } from "@/components/motion/landing";
import type { JournalBlock, JournalPage } from "@/lib/journal/format";
import { journal, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { EntryRow } from "./entry-row";
import { PaperRules } from "./paper-rules";

/**
 * The ruled page. It fills the space under the heading, so the rules
 * reach the bottom on a quiet day, and it draws them behind the blocks.
 *
 * Blocks sit one `journal.line` apart, which reads as one blank ruled
 * line. A block the user just sent rises with `Landing`; the append
 * mutation sets the mark under the block's own id.
 *
 * The notebook margin is one hairline the paper's whole height, so it
 * runs unbroken past the last entry.
 */
export function JournalPaper({
  page,
  onReference,
}: {
  page: JournalPage;
  onReference: (name: string) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const [height, setHeight] = React.useState(0);
  return (
    <View
      style={styles.paper}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <PaperRules height={height} />
      <View pointerEvents="none" style={styles.gutter} />
      {page.blocks.length === 0 ? (
        <Text style={styles.empty}>Nothing written yet today.</Text>
      ) : (
        page.blocks.map((block) => (
          <Landing
            key={block.id}
            id={block.id}
            rise={journal.line * 2}
            wash={false}
          >
            <Block block={block} onReference={onReference} />
          </Landing>
        ))
      )}
    </View>
  );
}

/** A time line with its bullets. A block with no bullets shows its time
    alone: the note said it, so the page says it. */
function Block({
  block,
  onReference,
}: {
  block: JournalBlock;
  onReference: (name: string) => void;
}) {
  if (block.entries.length === 0) {
    return <EntryRow blockTime={block.time} entry={null} onReference={onReference} />;
  }
  return (
    <>
      {block.entries.map((entry, index) => (
        <EntryRow
          key={entry.id}
          blockTime={index === 0 ? block.time : null}
          entry={entry}
          onReference={onReference}
        />
      ))}
    </>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    // The page fills its slot, so the rules reach the bottom of the
    // screen on a day with one line in it.
    paper: {
      flexGrow: 1,
      gap: journal.line,
    },
    gutter: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: journal.rail + spacing.s,
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.accentSoft,
    },
    empty: {
      ...type.body,
      lineHeight: journal.line,
      color: colors.inkMuted,
    },
  }),
});
