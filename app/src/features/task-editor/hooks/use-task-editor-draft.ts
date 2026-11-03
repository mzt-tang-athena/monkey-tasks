import * as React from "react";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";
import { useEditTask } from "@/stores/tasks/mutations/use-edit-task";
import type { TaskEdit, TaskItem } from "@/types/task";
import { safeFileName } from "@/lib/vault/file-name";
import { draftOf, parseLists, parseReminders } from "../lib/draft";

/**
 * SAF has no rename call: a rename writes the new file, copies the
 * text, and deletes the old one. Obsidian reads that as a delete plus
 * a create, so links to the old name do not follow. The first rename
 * in a session says so once; later ones stay quiet.
 */
let renameWarned = false;

/** React Native Web's Alert is a no-op, so the web gets the browser's. */
function warnRename(): void {
  const message =
    "Obsidian sees a delete and a create, so links to the old name will not follow.";
  if (Platform.OS === "web") {
    globalThis.alert(message);
    return;
  }
  Alert.alert("Rename changes the note file", message, [{ text: "OK" }]);
}

export type TaskEditorDraft = {
  draft: TaskEdit;
  change: (patch: Partial<TaskEdit>) => void;
  /** The lists as typed, one per line. The draft holds the parsed names. */
  listsText: string;
  setListsText: (text: string) => void;
  /** The reminders as typed, one per line. */
  remindersText: string;
  setRemindersText: (text: string) => void;
  canSave: boolean;
  saving: boolean;
  error: string | null;
  save: () => Promise<void>;
};

/**
 * The editor's draft and its save. The draft seeds from the task once
 * and is never reset, so a failed save keeps every keystroke. Save
 * writes through the edit mutation and goes back on success. A rename
 * to a new file name warns once per session.
 */
export function useTaskEditorDraft(task: TaskItem): TaskEditorDraft {
  const editTask = useEditTask();
  const [draft, setDraft] = React.useState<TaskEdit>(() => draftOf(task));
  // The text this draft was seeded from. The store may refresh while
  // the editor is open; a save still belongs to the text the user saw.
  const [openedText] = React.useState(task.text);
  const [listsText, setListsText] = React.useState(() =>
    draftOf(task).lists.join("\n"),
  );
  const [remindersText, setRemindersText] = React.useState(() =>
    draftOf(task).reminders.join("\n"),
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const change = (patch: Partial<TaskEdit>) => {
    setDraft((held) => ({ ...held, ...patch }));
  };

  const save = async () => {
    if (saving) {
      return;
    }
    const name = draft.name.trim();
    if (name === "") {
      setError("A task needs a name.");
      return;
    }
    const edit: TaskEdit = {
      ...draft,
      name,
      lists: parseLists(listsText),
      reminders: parseReminders(remindersText),
    };
    // The rename warning follows the file name the write will use,
    // not the display text: only a new file loses the old links.
    if (
      task.data?.title == null &&
      `${safeFileName(name)}.md` !== task.fileName &&
      !renameWarned
    ) {
      renameWarned = true;
      warnRename();
    }
    setSaving(true);
    setError(null);
    try {
      await editTask(task, edit, openedText);
      router.back();
    } catch (caught) {
      // The draft stays put: the user fixes what the write refused.
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  };

  return {
    draft,
    change,
    listsText,
    setListsText: (text) => {
      setListsText(text);
      change({ lists: parseLists(text) });
    },
    remindersText,
    setRemindersText: (text) => {
      setRemindersText(text);
      change({ reminders: parseReminders(text) });
    },
    canSave: draft.name.trim() !== "",
    saving,
    error,
    save,
  };
}
