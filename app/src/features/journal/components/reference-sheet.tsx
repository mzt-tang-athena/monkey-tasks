import * as React from "react";
import {
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { Banner } from "@/components/ui/banner";
import { LoadingState } from "@/components/ui/list-states";
import { Sheet } from "@/components/ui/sheet";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import { useReferenceNote } from "@/stores/journal/use-reference-note";
import { sheetMaxShare, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/**
 * A read-only look at `References/<name>.md`, opened from a link on the
 * page. A missing note says so and changes nothing: the link is the
 * operator's, not the app's.
 *
 * The sheet is its own small clock, like the composer's: it stays
 * mounted through its exit and the name stays for that frame.
 */
export function ReferenceSheet({
  name,
  onClose,
}: {
  /** The reference to show, or null when nothing is open. */
  name: string | null;
  onClose: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const window = useWindowDimensions();
  const [shown, setShown] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  // A new name opens the sheet during the render that sees it, so no
  // frame draws the previous reference over the tap. The same name
  // opens it again once the last close has left the tree.
  if (name != null && (name !== shown || !mounted)) {
    setShown(name);
    setMounted(true);
  }
  const open = name != null;
  const progress = useProgress(open, {
    ms: motion.ms.sheet,
    onSettled: (at) => at === 0 && setMounted(false),
  });

  const query = useReferenceNote(open ? shown : null);

  if (!mounted) {
    return null;
  }

  return (
    <Sheet
      open={open}
      progress={progress}
      onDismiss={onClose}
      scrim
      label={shown == null ? "Reference" : `Reference: ${shown}`}
      closeLabel="close reference"
    >
      <Text style={styles.title}>{shown ?? ""}</Text>
      {query.isPending ? (
        <LoadingState label="Reading the reference" />
      ) : query.isError ? (
        <Banner
          tone="danger"
          lines={["The reference note could not be read."]}
          actions={[
            {
              label: "Close",
              accessibilityLabel: "close reference",
              onPress: onClose,
            },
          ]}
        />
      ) : query.data == null ? (
        <Text style={styles.body}>That reference note is missing.</Text>
      ) : (
        <MotionScrollView
          style={{ maxHeight: Math.round(window.height * sheetMaxShare) }}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.body}>{query.data.trim()}</Text>
        </MotionScrollView>
      )}
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    title: {
      ...type.control,
      fontWeight: "700",
      color: colors.ink,
    },
    content: {
      gap: spacing.s,
    },
    body: {
      ...type.body,
      color: colors.ink,
    },
  }),
});
