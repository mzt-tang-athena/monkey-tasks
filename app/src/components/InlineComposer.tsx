import * as React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { parseCapture, type ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import { colors, fonts, spacing, radii } from "../theme/tokens";

// Web keeps a focus ring, but themed to the accent instead of the
// browser default black. The longhands are web-only styles.
const webFocusRing = Platform.select({
  web: {
    outlineColor: colors.accent,
    outlineStyle: "solid",
    outlineWidth: 2,
  } as unknown as TextStyle,
  default: {},
});

/**
 * The persistent inline composer: a pill text field docked above the
 * bottom bar, with the target-list chip inline. It reads as a text
 * field, not a button. Typing opens the keyboard in place and grows
 * the composer to show the parse preview and the Add button, so quick
 * capture never leaves the list. An optional details affordance hands
 * the draft to the full sheet.
 */
export function InlineComposer({
  targets,
  defaultTargetIndex,
  onSend,
  onOpenDetails,
}: {
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void;
  /** Opens the full sheet with the draft text, when details matter. */
  onOpenDetails?: (draft: string, targetIndex: number) => void;
}) {
  const [text, setText] = React.useState("");
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [focused, setFocused] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const expanded = focused || text.trim() !== "";
  const parsed = text.trim() ? parseCapture(text) : null;
  const canSend = text.trim() !== "" && !sending;

  const send = () => {
    const capture = parsed;
    if (!capture || sending) {
      return;
    }
    setSending(true);
    onSend(capture, targets[targetIndex] ?? targets[0]);
    setText("");
    setSending(false);
  };

  return (
    <View style={styles.dock}>
      <View style={styles.composerRow}>
        <Pressable
          style={({ pressed }) => [
            styles.chip,
            pressed && styles.chipPressed,
          ]}
          onPress={() =>
            setTargetIndex((index) => (index + 1) % targets.length)
          }
          accessibilityRole="button"
          accessibilityLabel="target list"
        >
          <Text style={styles.chipText}>
            {targetLabel(targets[targetIndex] ?? targets[0])}
          </Text>
        </Pressable>
        <TextInput
          style={[styles.input, webFocusRing]}
          placeholder="Add a task..."
          placeholderTextColor={colors.inkFaint}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={send}
          returnKeyType="send"
          multiline={false}
        />
        {onOpenDetails != null && expanded ? (
          <Pressable
            style={({ pressed }) => [
              styles.expand,
              pressed && styles.expandPressed,
            ]}
            onPress={() => {
              setFocused(false);
              onOpenDetails(text, targetIndex);
            }}
            accessibilityLabel="open capture details"
            accessibilityRole="button"
          >
            <Text style={styles.expandGlyph}>^</Text>
          </Pressable>
        ) : null}
      </View>
      {expanded ? (
        <View style={styles.expanded}>
          {parsed && parsed.name !== "" ? (
            <Text style={styles.preview} numberOfLines={1}>
              {parsed.matches?.length
                ? `parsed: ${parsed.matches.map((m) => m.text).join(", ")}`
                : "no date"}
              {" -> "}
              {parsed.name}
            </Text>
          ) : (
            <Text style={[styles.preview, styles.previewHint]}>
              {"Try \"tomorrow\" or \"friday 9am\" for a date."}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.send,
              pressed && canSend && styles.sendPressed,
              !canSend && styles.sendDisabled,
            ]}
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
          >
            <Text
              style={[styles.sendText, !canSend && styles.sendTextDisabled]}
            >
              Add
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function targetLabel(target: CaptureTarget): string {
  return target.kind === "main" ? "Main" : target.name;
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    gap: spacing.s,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    minHeight: 40,
    justifyContent: "center",
  },
  chipPressed: {
    backgroundColor: colors.pressed,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l,
    minHeight: 40,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  expand: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  expandPressed: {
    backgroundColor: colors.pressed,
  },
  expandGlyph: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  expanded: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    paddingBottom: spacing.s,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.accent,
  },
  previewHint: {
    color: colors.inkFaint,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l,
    minHeight: 36,
    justifyContent: "center",
  },
  sendPressed: {
    backgroundColor: colors.accentDeep,
  },
  sendDisabled: {
    backgroundColor: colors.pressed,
  },
  sendText: {
    color: colors.onAccent,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
  },
  sendTextDisabled: {
    color: colors.inkFaint,
  },
});
