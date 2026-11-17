import * as React from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  captureText,
  sheetMaxShare,
  sheetReserve,
  spacing,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { NoteSheetState } from "../hooks/use-note-sheet";

// The browser's focus ring is suppressed on web so no UA ring appears
// inside the panel, as the capture input does it.
const noFocusOutline = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});

/**
 * The composer: a multiline body, an optional title and the send
 * button. The title field is revealed only when it is wanted, so the
 * zero-title path never touches it. The markdown is stored as typed.
 */
export function NoteForm({ sheet }: { sheet: NoteSheetState }) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const window = useWindowDimensions();
  const maxInputHeight = Math.max(
    captureText.minHeight,
    Math.round(
      Math.min(window.height * sheetMaxShare, window.height - sheetReserve),
    ),
  );
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);

  const send = () => {
    if (!sheet.canSend) {
      return;
    }
    inputRef.current?.blur();
    sheet.send();
  };

  return (
    <>
      {sheet.titleOpen ? (
        <TextField
          label="Title"
          value={sheet.title}
          onChangeText={sheet.setTitle}
          placeholder="A name for the note"
          autoCapitalize="sentences"
          autoCorrect
          editable={!sheet.sending}
        />
      ) : (
        <View style={styles.reveal}>
          <Button
            variant="text"
            tone="accent"
            label="Add title"
            onPress={sheet.revealTitle}
            accessibilityLabel="add a title"
          />
        </View>
      )}
      <TextInput
        ref={inputRef}
        style={[styles.input, { maxHeight: maxInputHeight }]}
        placeholder="Write a note"
        placeholderTextColor={colors.inkFaint}
        value={sheet.body}
        onChangeText={sheet.setBody}
        multiline
        submitBehavior="newline"
        autoFocus
        selectionColor={colors.accent}
        accessibilityLabel="note text"
      />
      <View style={styles.actions}>
        <View style={styles.spacer} />
        <Button
          label="save note"
          onPress={send}
          shape="circle"
          disabled={!sheet.canSend}
          busy={sheet.sending}
          hitSlop={6}
          accessibilityLabel="save note"
        />
      </View>
    </>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    reveal: {
      alignItems: "flex-start",
    },
    input: {
      ...type.body,
      minHeight: captureText.minHeight,
      color: colors.ink,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.s,
      ...noFocusOutline,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    spacer: {
      flex: 1,
    },
  }),
});
