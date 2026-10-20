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
 * Variant E capture affordance: a persistent inline composer docked
 * above the bottom bar, not a modal and not a round button. Idle, it
 * is a pill-shaped field that reads "Add a task..." with the target
 * chip inline next to it. Focusing it opens the keyboard in place:
 * the field expands, the parse preview and Add button appear, and the
 * chip stays inline. Send or an empty blur collapses it again.
 */
export function CaptureSheet({
  targets,
  defaultTargetIndex,
  preselectedDue,
  onSend,
}: {
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  preselectedDue?: string;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void;
}) {
  const [text, setText] = React.useState("");
  const [active, setActive] = React.useState(false);
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [lastParse, setLastParse] = React.useState<ParsedCapture | null>(null);
  const [sending, setSending] = React.useState(false);

  const canSend = text.trim() !== "" && !sending;

  const send = () => {
    const parsed = parseCapture(text);
    if (!parsed || sending) {
      return;
    }
    setSending(true);
    onSend(parsed, targets[targetIndex] ?? targets[0]);
    setText("");
    setLastParse(null);
    setActive(false);
    setSending(false);
  };

  const collapse = () => {
    if (text.trim() === "") {
      setActive(false);
      setLastParse(null);
    }
  };

  const cycleTarget = () => {
    setTargetIndex((index) => (index + 1) % targets.length);
  };

  const target = targets[targetIndex] ?? targets[0];

  if (!active) {
    // Idle: the pill field and the target chip, one quiet row.
    return (
      <View style={styles.dock}>
        <Pressable
          style={[styles.idleRow, webFocusRing]}
          onPress={() => setActive(true)}
          accessibilityRole="button"
          accessibilityLabel="add a task"
        >
          <Text style={styles.placeholder}>Add a task...</Text>
        </Pressable>
        <TargetChip label={targetLabel(target)} onPress={cycleTarget} />
      </View>
    );
  }

  return (
    <View style={[styles.dock, styles.dockActive]}>
      <TextInput
        style={[styles.input, webFocusRing]}
        placeholder="Add a task..."
        placeholderTextColor={colors.inkFaint}
        value={text}
        autoFocus
        multiline
        onChangeText={(value) => {
          setText(value);
          setLastParse(value.trim() ? parseCapture(value) : null);
        }}
        onBlur={collapse}
        onSubmitEditing={send}
        returnKeyType="send"
      />
      {preselectedDue && !lastParse?.due ? (
        <Text style={styles.dueNote}>due {preselectedDue}</Text>
      ) : null}
      {lastParse && lastParse.name !== "" ? (
        <Text style={styles.preview}>
          {lastParse.matches?.length
            ? `parsed: ${lastParse.matches.map((m) => m.text).join(", ")}`
            : "no date"}
          {" -> "}
          {lastParse.name}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <TargetChip label={targetLabel(target)} onPress={cycleTarget} />
        <View style={styles.spring} />
        <Pressable
          style={[styles.send, !canSend && styles.sendDisabled]}
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
        >
          <Text
            style={[
              styles.sendText,
              !canSend && styles.sendTextDisabled,
            ]}
          >
            Add
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TargetChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="change target list"
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function targetLabel(target: CaptureTarget): string {
  return target.kind === "main" ? "Main" : target.name;
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
  },
  dockActive: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.s,
    paddingBottom: spacing.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  idleRow: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    justifyContent: "center",
    paddingHorizontal: spacing.l,
  },
  placeholder: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },
  input: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  dueNote: {
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    paddingHorizontal: spacing.xs,
  },
  preview: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    paddingHorizontal: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    minHeight: 32,
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
  spring: {
    flex: 1,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.xs,
    minHeight: 32,
    justifyContent: "center",
  },
  sendDisabled: {
    backgroundColor: colors.pressed,
  },
  sendTextDisabled: {
    color: colors.inkFaint,
  },
  sendText: {
    color: colors.onAccent,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    fontWeight: "600",
  },
});
