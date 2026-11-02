import * as React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, radius, spacing, type } from "@/theme/tokens";

/**
 * A labelled text input: the label above, the input, then a hint or
 * an error below. The label names the input for assistive tech, and
 * the hint or the error describes it. An error also marks the input
 * invalid and draws its edge in the danger color.
 */
export function TextField({
  label,
  hint,
  error,
  multiline,
  ...input
}: {
  label: string;
  hint?: string;
  error?: string | null;
  multiline?: boolean;
} & Omit<TextInputProps, "multiline" | "style" | "accessibilityLabel">) {
  const id = React.useId();
  const note = error ?? hint;
  const noteId = `${id}-note`;
  const invalid = error != null;
  return (
    <View style={styles.field}>
      {/* The input carries the label as its name, so the label itself
          stays out of the reading order. */}
      <Text style={styles.label} aria-hidden>
        {label}
      </Text>
      <TextInput
        {...input}
        style={[
          styles.input,
          multiline && styles.multiline,
          invalid && styles.inputInvalid,
        ]}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.accent}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={note != null ? noteId : undefined}
        accessibilityHint={note ?? undefined}
      />
      {note != null ? (
        <Text nativeID={noteId} style={invalid ? styles.error : styles.hint}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...type.eyebrow,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: colors.inkMuted,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    ...type.body,
    color: colors.ink,
  },
  multiline: {
    minHeight: 96,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  hint: {
    ...type.caption,
    color: colors.inkFaint,
  },
  error: {
    ...type.caption,
    color: colors.danger,
  },
});
