import * as React from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { parseCapture, type ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import { theme } from "../theme/tokens";

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
  const [focused, setFocused] = React.useState(false);
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [lastParse, setLastParse] = React.useState<ParsedCapture | null>(null);

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

  const canSend = text.trim() !== "";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <TextInput
            style={[styles.input, focused && styles.inputFocused]}
            placeholder="Add a task..."
            placeholderTextColor={theme.colors.textFaint}
            value={text}
            onChangeText={(value) => {
              setText(value);
              setLastParse(value.trim() ? parseCapture(value) : null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
            >
              <Text style={styles.chipText}>
                {targetLabel(targets[targetIndex] ?? targets[0])}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={({ pressed }) => [
                styles.send,
                pressed && styles.sendPressed,
                !canSend && styles.sendDisabled,
              ]}
              disabled={!canSend}
              onPress={send}
            >
              <Text style={styles.sendText}>Add</Text>
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
    backgroundColor: theme.colors.scrim,
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    gap: theme.spacing[2],
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[6],
  },
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.type.body.fontSize,
    padding: theme.spacing[3],
  },
  inputFocused: {
    borderColor: theme.colors.accent,
  },
  dueNote: {
    color: theme.colors.success,
    fontSize: theme.type.small.fontSize,
  },
  preview: {
    color: theme.colors.textMuted,
    fontSize: theme.type.small.fontSize,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing[2],
    marginTop: theme.spacing[1],
  },
  chip: {
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  chipPressed: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  chipText: {
    color: theme.colors.text,
    fontSize: theme.type.small.fontSize,
    fontWeight: theme.weights.medium,
  },
  send: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  sendPressed: {
    backgroundColor: theme.colors.accentPressed,
  },
  sendDisabled: {
    opacity: 0.35,
  },
  sendText: {
    color: theme.colors.onAccent,
    fontSize: theme.type.body.fontSize,
    fontWeight: theme.weights.semibold,
  },
});
