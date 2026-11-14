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
import { Pill } from "@/components/ui/pill";
import {
  journal,
  sheetMaxShare,
  sheetReserve,
  spacing,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import type { EntryDraft } from "../hooks/use-entry-draft";

// The browser's focus ring is suppressed on web so no UA ring appears
// inside the panel, as the capture input does it.
const noFocusOutline = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});

const autoSizedInput = Platform.select({
  web: { fieldSizing: "content" } as unknown as TextStyle,
  default: {},
});

/**
 * The composer's content: a multiline field, the Food chip and the send
 * control. Everything that changes lives in the draft or in the props.
 *
 * Return adds a line here, unlike capture, where it sends: one line is
 * one bullet, so a multi-line entry is the normal case. The send
 * control is the only way out, and it drops focus and closes the sheet
 * in the same frame the write starts.
 */
export function EntryForm({
  draft,
  food,
  onToggleFood,
  onClose,
}: {
  draft: EntryDraft;
  food: boolean;
  onToggleFood: () => void;
  onClose: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const window = useWindowDimensions();
  const maxInputHeight = Math.max(
    journal.line * 2,
    Math.round(
      Math.min(window.height * sheetMaxShare, window.height - sheetReserve),
    ),
  );
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);

  const send = () => {
    if (!draft.canSend) {
      return;
    }
    // The keyboard and the sheet leave in one frame: blur starts the
    // keyboard down, close starts the sheet down, and the write runs
    // behind both.
    inputRef.current?.blur();
    onClose();
    draft.send();
  };

  return (
    <>
      <TextInput
        ref={inputRef}
        style={[styles.input, autoSizedInput, { maxHeight: maxInputHeight }]}
        placeholder={food ? "What did you eat?" : "What happened?"}
        placeholderTextColor={colors.inkMuted}
        value={draft.text}
        onChangeText={draft.setText}
        multiline
        submitBehavior="newline"
        autoFocus
        selectionColor={colors.accent}
        accessibilityLabel="entry text"
      />
      <View style={styles.actions}>
        <Pill
          label="Food"
          selected={food}
          onPress={onToggleFood}
          accessibilityLabel={food ? "food entry: on" : "food entry: off"}
        />
        <View style={styles.spacer} />
        <Button
          label="send entry"
          onPress={send}
          shape="circle"
          disabled={!draft.canSend}
          busy={draft.sending}
          hitSlop={6}
          accessibilityLabel="send entry"
        />
      </View>
    </>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    input: {
      ...type.body,
      lineHeight: journal.line,
      minHeight: journal.line * 2,
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
