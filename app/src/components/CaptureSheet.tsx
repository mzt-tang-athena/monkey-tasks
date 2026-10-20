import * as React from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { parseCapture, type ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";

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

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <TextInput
            style={styles.input}
            placeholder="Add a task..."
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
            <Pressable style={styles.chip} onPress={cycleTarget}>
              <Text style={styles.chipText}>
                {targetLabel(targets[targetIndex] ?? targets[0])}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={[styles.send, text.trim() === "" && styles.sendDisabled]}
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
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#bbbbbb",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  dueNote: {
    color: "#1d5c3f",
    fontSize: 13,
  },
  preview: {
    color: "#555555",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#bbbbbb",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    color: "#222222",
  },
  send: {
    backgroundColor: "#1d3fbf",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
