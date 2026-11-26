import * as React from "react";
import {
  Platform,
  StyleSheet,
  Text,
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
import { Pressable } from "@/components/ui/pressable";
import {
  captureText,
  fonts,
  radii,
  spacing,
  sheetMaxShare,
  sheetReserve,
  type,
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
  // A closed picker gives the caret back, so the operator keeps typing
  // with the keyboard still up.
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
  // A link is offered after the title when the task lands on a list. A
  // link already attached stays on screen on any target, so the sheet
  // never hides what the task will carry.
  const linking = draft.target.kind === "list" || draft.references.length > 0;

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
      {linking ? (
        <View style={styles.links}>
          {draft.references.map((name) => (
            <Pressable
              key={name}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={() => draft.removeReference(name)}
              accessibilityRole="button"
              accessibilityLabel={`remove reference ${name}`}
            >
              <Text style={styles.linkText} numberOfLines={1}>
                {name}
              </Text>
              <Icon name="close" size={12} color="accent" />
            </Pressable>
          ))}
          {draft.target.kind === "list" ? (
            <Pill
              label="Link a reference"
              accessibilityLabel="link a reference"
              onPress={onOpenReferences}
            >
              <Icon name="plus" size={14} color="accent" />
            </Pill>
          ) : null}
        </View>
      ) : null}
      <CaptureChips parsed={draft.parsed} />
      <View style={styles.actions}>
        <Pill
          label={label}
          onPress={draft.cycleTarget}
          accessibilityLabel={`target list: ${label}`}
        />
        <View style={styles.spacer} />
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
    links: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.s,
    },
    link: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.m,
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
    },
    linkText: {
      ...type.control,
      maxWidth: 200,
      color: colors.accent,
      fontWeight: "600",
    },
    pressed: {
      backgroundColor: colors.pressed,
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
