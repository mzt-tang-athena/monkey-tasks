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
 * Variant F capture affordance: a persistent inline composer docked
 * above the bottom navbar. It is a text field, not a button: a pill
 * input reading "Add a task...", with the target-list chip inline
 * next to it. Typing opens the keyboard in place; a small Add control
 * appears inside the pill once there is text. Default, focused, and
 * disabled states all ship.
 */
export function InlineComposer({
  targets,
  defaultTargetIndex,
  preselectedDue,
  onSend,
}: {
  /** Main first, then the lists. */
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  preselectedDue?: string;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void;
}) {
  const [text, setText] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [lastParse, setLastParse] = React.useState<ParsedCapture | null>(null);

  const canSend = text.trim() !== "";

  const send = () => {
    const parsed = parseCapture(text);
    if (!parsed) {
      return;
    }
    setText("");
    setLastParse(null);
    onSend(parsed, targets[targetIndex] ?? targets[0]);
  };

  const cycleTarget = () => {
    setTargetIndex((index) => (index + 1) % targets.length);
  };

  return (
    <View style={styles.dock}>
      <Pressable
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        onPress={cycleTarget}
        accessibilityRole="button"
        accessibilityLabel={`target list ${targetLabel(
          targets[targetIndex] ?? targets[0],
        )}, tap to change`}
      >
        <Text style={styles.chipText}>
          {targetLabel(targets[targetIndex] ?? targets[0])}
        </Text>
      </Pressable>

      <View style={[styles.pill, focused && styles.pillFocused]}>
        <TextInput
          style={[styles.input, webFocusRing]}
          placeholder="Add a task..."
          placeholderTextColor={colors.inkFaint}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setLastParse(value.trim() ? parseCapture(value) : null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={canSend ? send : undefined}
          returnKeyType="send"
          accessibilityLabel="add a task"
        />
        {preselectedDue && !lastParse?.due ? (
          <Text style={styles.dueNote}>{preselectedDue}</Text>
        ) : null}
        <Pressable
          style={[styles.send, !canSend && styles.sendDisabled]}
          onPress={canSend ? send : undefined}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="add task"
          accessibilityState={{ disabled: !canSend }}
        >
          <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>
            Add
          </Text>
        </Pressable>
      </View>

      {lastParse && lastParse.name !== "" ? (
        <Text style={styles.preview}>
          {lastParse.matches?.length
            ? `parsed: ${lastParse.matches.map((m) => m.text).join(", ")}`
            : "no date"}
          {" -> "}
          {lastParse.name}
        </Text>
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
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    gap: spacing.xs,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    minHeight: 32,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: spacing.s,
  },
  chipPressed: {
    backgroundColor: colors.pressed,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    paddingLeft: spacing.l,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 48,
    gap: spacing.s,
  },
  pillFocused: {
    borderColor: colors.accent,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.ink,
    paddingVertical: spacing.s,
  },
  dueNote: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.accent,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    minHeight: 36,
    justifyContent: "center",
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
  preview: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    paddingBottom: spacing.xs,
  },
});
