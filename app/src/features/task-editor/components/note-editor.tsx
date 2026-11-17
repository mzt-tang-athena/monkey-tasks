import * as React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { SheetGrab } from "@/components/motion/sheet-drag";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { radius, spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { useSheetClock } from "../hooks/use-sheet-clock";

/**
 * The note editor: a full height surface over the editor sheet, with a
 * plain markdown field. Done writes the text and returns. The scrim,
 * Escape, Android back and a drag down on the header write it too, so
 * no keystroke is lost.
 */
export function NoteEditor({
  open,
  text,
  onClose,
}: {
  open: boolean;
  text: string;
  /** The text on close, or null when it did not change. */
  onClose: (text: string | null) => void;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // The sheet lifts by the keyboard's height, so the surface gives that
  // height back. The header stays on screen and the field scrolls.
  const keyboard = useKeyboardState((state) => state.height);
  const { mounted, progress } = useSheetClock(open);
  // The field starts from the saved text each time it opens.
  const [draft, setDraft] = React.useState(text);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setDraft(text);
    }
  }
  if (!mounted) {
    return null;
  }
  return (
    <Sheet
      open={open}
      onDismiss={() => onClose(draft === text ? null : draft)}
      progress={progress}
      rideKeyboard
      scrim
      stacked
      label="Note"
      closeLabel="close the note"
    >
      {/* The sheet already rides the keyboard, so the surface only
          takes the room above it, and the field scrolls inside. */}
      <View
        style={[
          styles.fill,
          {
            height: Math.max(
              240,
              window.height - keyboard - insets.top - insets.bottom - 48,
            ),
          },
        ]}
      >
        <SheetGrab>
          <View style={styles.header}>
            <Text style={styles.title}>Note</Text>
            <Button
              label="Done"
              accessibilityLabel="done with the note"
              onPress={() => onClose(draft === text ? null : draft)}
            />
          </View>
        </SheetGrab>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          placeholder="Write a note in markdown"
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.accent}
          aria-label="Note"
          textAlignVertical="top"
          style={styles.input}
        />
      </View>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    fill: {
      gap: spacing.s,
    },
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
    input: {
      flex: 1,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      ...type.body,
      color: colors.ink,
    },
  }),
});
