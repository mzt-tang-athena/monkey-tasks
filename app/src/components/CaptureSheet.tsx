import * as React from "react";
import { GestureResponderEvent, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { parseCapture, type ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import { t } from "../theme/tokens";

/**
 * The capture sheet: input, target-list chip, send. The target shows
 * where the capture will land; tap it to cycle. Main targets write no
 * lists property.
 */
export function CaptureSheet({
  visible,
  targets,
  defaultTargetIndex,
  preselectedDue,
  onClose,
  onSend,
}: {
  visible: boolean;
  /** Main first, then the lists. */
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  preselectedDue?: string;
  onClose: () => void;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void;
}) {
  // The parent remounts this sheet on open, so local state starts
  // fresh; no reset effect needed.
  const [text, setText] = React.useState("");
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [lastParse, setLastParse] = React.useState<ParsedCapture | null>(null);
  const [inputFocused, setInputFocused] = React.useState(false);

  const send = () => {
    const parsed = parseCapture(text);
    if (!parsed) {
      return;
    }
    onSend(parsed, targets[targetIndex] ?? targets[0]);
    onClose();
  };

  const cycleTarget = () => {
    setTargetIndex((index) => (index + 1) % targets.length);
  };

  const disabledSend = text.trim() === "";

  // On web the press bubbles from the sheet; a tap inside must not close it.
  const dismissOnBackdrop = (event: GestureResponderEvent) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={dismissOnBackdrop} accessibilityLabel="close capture sheet">
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <TextInput
            style={[styles.input, inputFocused && styles.inputFocused]}
            placeholder="Add a task..."
            placeholderTextColor={t.colors.textFaint}
            value={text}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
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
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={cycleTarget}
              accessibilityLabel="change target list"
              accessibilityRole="button"
            >
              <Text style={styles.chipText}>
                {targetLabel(targets[targetIndex] ?? targets[0])}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={({ pressed }) => [
                styles.send,
                pressed && !disabledSend && styles.sendPressed,
                disabledSend && styles.sendDisabled,
              ]}
              onPress={send}
              disabled={disabledSend}
              accessibilityLabel="add task"
              accessibilityRole="button"
              accessibilityState={{ disabled: disabledSend }}
            >
              <Text style={[styles.sendText, disabledSend && styles.sendTextDisabled]}>
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
    backgroundColor: t.colors.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: t.colors.surfaceRaised,
    borderTopLeftRadius: t.radii.lg,
    borderTopRightRadius: t.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  input: {
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radii.md,
    padding: t.spacing.md,
    fontSize: 16,
    color: t.colors.text,
    fontFamily: t.fonts.sans,
  },
  inputFocused: {
    borderColor: t.colors.borderStrong,
  },
  dueNote: {
    color: t.colors.success,
    fontSize: 13,
    fontFamily: t.fonts.sans,
  },
  preview: {
    color: t.colors.textMuted,
    fontSize: 13,
    fontFamily: t.fonts.sans,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    borderRadius: t.radii.pill,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
  },
  chipPressed: {
    backgroundColor: t.colors.surfaceActive,
  },
  chipText: {
    fontSize: 14,
    color: t.colors.text,
    fontFamily: t.fonts.sans,
  },
  send: {
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.pill,
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.md,
  },
  sendPressed: {
    backgroundColor: t.colors.accentDeep,
  },
  sendDisabled: {
    backgroundColor: t.colors.surfaceActive,
  },
  sendText: {
    color: t.colors.onAccent,
    fontWeight: "700",
    fontFamily: t.fonts.sans,
  },
  sendTextDisabled: {
    color: t.colors.textFaint,
  },
});
