import * as React from "react";
import {
  Modal,
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
 * The capture sheet: input, target-list chip, send. The target shows
 * where the capture will land; tap it to cycle. Main targets write no
 * lists property. The inline composer hands its draft here when the
 * writer wants the full form.
 */
export function CaptureSheet({
  visible,
  targets,
  defaultTargetIndex,
  preselectedDue,
  initialText = "",
  onClose,
  onSend,
}: {
  visible: boolean;
  /** Main first, then the lists. */
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  preselectedDue?: string;
  /** A draft carried over from the inline composer. */
  initialText?: string;
  onClose: () => void;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void;
}) {
  // The parent remounts this sheet on open, so local state starts
  // fresh; no reset effect needed.
  const [text, setText] = React.useState(initialText);
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
    onClose();
  };

  const cycleTarget = () => {
    setTargetIndex((index) => (index + 1) % targets.length);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <TextInput
            style={[styles.input, webFocusRing]}
            placeholder="Add a task..."
            placeholderTextColor={colors.inkFaint}
            value={text}
            onChangeText={(value) => {
              setText(value);
              setLastParse(value.trim() ? parseCapture(value) : null);
            }}
            onSubmitEditing={send}
            returnKeyType="send"
            autoFocus
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
            <Pressable
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
              ]}
              onPress={cycleTarget}
              accessibilityRole="button"
            >
              <Text style={styles.chipText}>
                {targetLabel(targets[targetIndex] ?? targets[0])}
              </Text>
            </Pressable>
            <View style={styles.spring} />
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
                style={[
                  styles.sendText,
                  !canSend && styles.sendTextDisabled,
                ]}
              >
                Add
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function targetLabel(target: CaptureTarget): string {
  return target.kind === "main" ? "Main" : target.name;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.l + 4,
    borderTopRightRadius: radii.l + 4,
    paddingTop: spacing.s,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xl,
    gap: spacing.m,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    borderRadius: radii.m,
    padding: spacing.m,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  dueNote: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: fonts.body,
  },
  preview: {
    color: colors.inkMuted,
    fontSize: 13,
    fontFamily: fonts.body,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    minHeight: 36,
    justifyContent: "center",
  },
  chipPressed: {
    backgroundColor: colors.pressed,
  },
  chipText: {
    fontSize: 14,
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
    minHeight: 44,
    justifyContent: "center",
  },
  sendDisabled: {
    backgroundColor: colors.pressed,
  },
  sendPressed: {
    backgroundColor: colors.accentDeep,
  },
  sendTextDisabled: {
    color: colors.inkFaint,
  },
  sendText: {
    color: colors.onAccent,
    fontFamily: fonts.body,
    fontWeight: "600",
  },
});
