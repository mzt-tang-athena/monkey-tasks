import * as React from "react";
import { StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Banner } from "@/components/ui/banner";
import { TextField } from "@/components/ui/text-field";
import type { TaskItem } from "@/types/task";
import { measure, pageGutter, spacing } from "@/theme/tokens";
import { useTaskEditorDraft } from "../hooks/use-task-editor-draft";
import { EditorHeader } from "./editor-header";

/**
 * The editor for a task note: the header and the fields. The fields
 * scroll in a `KeyboardAwareScrollView`. Android runs edge to edge and
 * never resizes the window for the keyboard (ADR 0014), so the view
 * lifts the focused field above the keyboard itself.
 */
export function TaskEditorForm({ task }: { task: TaskItem }) {
  const editor = useTaskEditorDraft(task);
  const { draft, change, saving } = editor;

  return (
    <>
      <EditorHeader
        saving={saving}
        canSave={editor.canSave}
        onSave={() => void editor.save()}
      />
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={spacing.l}
      >
        {editor.error != null ? (
          <Banner tone="danger" lines={[editor.error]} />
        ) : null}

        <TextField
          label="Name"
          value={draft.name}
          onChangeText={(name) => change({ name })}
          placeholder="Task name"
          autoCapitalize="sentences"
          autoCorrect
          editable={!saving}
        />
        <TextField
          label="Due"
          value={draft.due ?? ""}
          onChangeText={(due) => change({ due: due.trim() === "" ? null : due })}
          placeholder="2026-10-21 or 2026-10-21T15:00"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
        />
        <TextField
          label="Recurrence"
          value={draft.recurrence ?? ""}
          onChangeText={(recurrence) =>
            change({
              recurrence: recurrence.trim() === "" ? null : recurrence,
            })
          }
          placeholder="FREQ=WEEKLY"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
        />
        <TextField
          label="Lists"
          value={editor.listsText}
          onChangeText={editor.setListsText}
          placeholder={"Focus\nErrands"}
          hint="One list name per line."
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          editable={!saving}
        />
        <TextField
          label="Reminders"
          value={editor.remindersText}
          onChangeText={editor.setRemindersText}
          placeholder={"2026-10-21T09:00\n2026-10-21T18:30"}
          hint="One datetime per line."
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          editable={!saving}
        />
        <TextField
          label="Body"
          value={draft.body}
          onChangeText={(body) => change({ body })}
          placeholder="Notes"
          autoCapitalize="sentences"
          autoCorrect
          multiline
          editable={!saving}
        />
      </KeyboardAwareScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // The error banner and the fields, one step apart.
  content: {
    maxWidth: measure,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: pageGutter,
    paddingTop: spacing.l,
    paddingBottom: spacing.xxxl,
    gap: spacing.l,
  },
});
