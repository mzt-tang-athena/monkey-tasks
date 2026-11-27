import * as React from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import type { CaptureDraft } from "@/features/capture/hooks/use-capture-draft";
import { targetLabel } from "@/features/capture/lib/chip-labels";
import { CaptureChips } from "./capture-chips";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import {
  captureText,
  fonts,
  spacing,
  sheetMaxShare,
  sheetReserve,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { CaptureReference } from "./capture-reference";

// The sheet input carries focus by caret and placeholder alone: no
// app ring, and the browser's own focus outline is suppressed on
// web so no UA ring can appear either.
const noFocusOutline = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});

// The input follows its text both ways (grow and shrink) natively
// via CSS field sizing; the max-height cap scrolls past the cap.
const autoSizedInput = Platform.select({
  web: { fieldSizing: "content" } as unknown as TextStyle,
  default: {},
});

/**
 * The content of the capture sheet: the input, the reference the task
 * points at, the parse chips and the action row. Everything that
 * changes lives in the draft or in the props. The form only renders
 * them. The `Sheet` around it owns the scrim, the keyboard lift and the
 * dialog.
 */
export function CaptureForm({
  draft,
  onClose,
  referenceOpen,
  onOpenReferences,
  onCloseReferences,
}: {
  draft: CaptureDraft;
  onClose: () => void;
  referenceOpen: boolean;
  onOpenReferences: () => void;
  onCloseReferences: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const window = useWindowDimensions();
  // The input's cap: sheetMaxShare of the window, less the room the
  // keyboard and the panel's fixed chrome need. The input follows its
  // text both ways inside it.
  const maxInputHeight = Math.max(
    captureText.minHeight,
    Math.round(
      Math.min(window.height * sheetMaxShare, window.height - sheetReserve),
    ),
  );
  // The input, so send can drop focus, and with it the keyboard, in
  // the same frame the sheet starts to close.
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const focusInput = React.useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const send = () => {
    if (!draft.canSend) {
      return;
    }
    // The keyboard and the sheet leave in one frame: blur starts the
    // keyboard down, close starts the sheet down, and the write runs
    // behind both of them.
    inputRef.current?.blur();
    onClose();
    draft.send();
  };

  const label = targetLabel(draft.target);

  return (
    <>
      <TextInput
        ref={inputRef}
        style={[styles.input, autoSizedInput, { maxHeight: maxInputHeight }]}
        placeholder="Add a task"
        placeholderTextColor={colors.inkFaint}
        value={draft.text}
        onChangeText={draft.setText}
        onSubmitEditing={send}
        returnKeyType="send"
        // A multiline input defaults to newline on Android, which
        // swallows the send action. Submit keeps the sheet able to
        // grow and still fires onSubmitEditing.
        submitBehavior="submit"
        multiline
        autoFocus
        selectionColor={colors.accent}
      />
      <CaptureChips parsed={draft.parsed} />
      <View style={styles.actions}>
        <View style={styles.controls}>
          <Pill
            label={label}
            onPress={draft.cycleTarget}
            accessibilityLabel={`target list: ${label}`}
            trailing={<Icon name="caret-up-down" color="accent" />}
          />
          {draft.target.kind === "list" ? (
            <Pill
              label="Link a reference"
              accessibilityLabel="link a reference"
              onPress={onOpenReferences}
              labelHidden
            >
              <Icon name="link" color="accent" />
            </Pill>
          ) : null}
          {draft.references.map((name) => (
            <Pill
              key={name}
              label={name}
              accessibilityLabel={`remove reference ${name}`}
              onPress={() => draft.removeReference(name)}
              trailing={<Icon name="close" size={12} color="accent" />}
            />
          ))}
        </View>
        <Button
          label="send task"
          onPress={send}
          shape="circle"
          disabled={!draft.canSend}
          busy={draft.sending}
          hitSlop={6}
          accessibilityLabel="send task"
        />
      </View>
      <CaptureReference
        open={referenceOpen}
        attached={draft.references}
        onAttach={draft.addReference}
        onClose={onCloseReferences}
        returnFocus={focusInput}
      />
    </>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    input: {
      fontSize: captureText.size,
      lineHeight: captureText.line,
      fontFamily: fonts.body,
      color: colors.ink,
      minHeight: captureText.minHeight,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.m,
      ...noFocusOutline,
    },
    // The controls share one row, wrapping only when attached
    // references outgrow it. Send keeps the row's top right.
    actions: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.s,
    },
    controls: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.xs,
    },
  }),
});
