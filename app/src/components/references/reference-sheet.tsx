import * as React from "react";
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotionScrollView } from "@/components/motion/scroll-view";
import { SheetGrab } from "@/components/motion/sheet-drag";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useClampedHeight } from "@/hooks/use-clamped-height";
import { useSheetClock } from "@/hooks/use-sheet-clock";
import { spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { ReferenceNote } from "@/types/reference";

/** The note as the sheet reads it: no blank lines around the text. */
export function previewText(body: string): string {
  return body.replace(/^(\r?\n)+/, "").replace(/\s+$/, "");
}

/**
 * A reference note, read-only, over the sheet that holds the link. The
 * scrim, Escape and Android back close it and give focus back, as every
 * stacked sheet does. A note that left the vault says so and offers to
 * detach the link that no longer resolves.
 */
export function ReferenceSheet({
  open,
  name,
  note,
  loading,
  onClose,
  onDetach,
}: {
  open: boolean;
  /** The link's target, shown while the note is missing. */
  name: string;
  /** The note, or null when it is missing or still loading. */
  note: ReferenceNote | null;
  loading: boolean;
  onClose: () => void;
  onDetach: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { mounted, progress } = useSheetClock(open);
  const cap = Math.max(240, window.height * 0.8 - insets.top);
  const body = useClampedHeight(cap);
  if (!mounted) {
    return null;
  }
  const words =
    note == null ? "" : [...note.categories, ...note.types].join(" · ");
  return (
    <Sheet
      open={open}
      onDismiss={onClose}
      progress={progress}
      scrim
      stacked
      label="Reference"
      closeLabel="close the reference"
    >
      <SheetGrab>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {name === "" ? "Reference" : name}
          </Text>
          <Button
            variant="text"
            label="Done"
            accessibilityLabel="done with the reference"
            onPress={onClose}
          />
        </View>
      </SheetGrab>
      <MotionScrollView
        style={{ height: body.height, maxHeight: cap }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body} onLayout={body.onLayout}>
          {words === "" ? null : <Text style={styles.words}>{words}</Text>}
          {loading ? (
            <Text style={styles.note}>Reading the note.</Text>
          ) : note == null ? (
            <View style={styles.missing}>
              <Text style={styles.note}>
                {"That note is not in the References folder. It may have been renamed or deleted."}
              </Text>
              <Button
                variant="text"
                tone="danger"
                label="Detach"
                accessibilityLabel="detach the missing reference"
                onPress={onDetach}
              />
            </View>
          ) : previewText(note.body) === "" ? (
            <Text style={styles.note}>This note has no text.</Text>
          ) : (
            <Text style={styles.note}>{previewText(note.body)}</Text>
          )}
        </View>
      </MotionScrollView>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      gap: spacing.s,
    },
    title: {
      flex: 1,
      ...type.title,
      color: colors.ink,
    },
    body: {
      gap: spacing.m,
      paddingBottom: spacing.s,
    },
    words: {
      ...type.caption,
      color: colors.inkMuted,
    },
    note: {
      ...type.body,
      color: colors.ink,
    },
    missing: {
      gap: spacing.s,
    },
  }),
});
