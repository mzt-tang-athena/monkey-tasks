import * as React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseFrontmatter } from "@monkey-tasks/schemas";
import { useStoreMeta, useTaskList } from "@/store/task-state";
import { useTaskActions } from "@/store/task-actions";
import type { TaskEdit, TaskItem } from "@/types/task";
import { safeFileName } from "@/features/capture/write";
import {
  colors,
  fonts,
  measure,
  pageGutter,
  radius,
  spacing,
} from "@/theme/tokens";

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

/** The draft the editor holds: the vault fields, plain. */
function draftOf(task: TaskItem): TaskEdit {
  return {
    name: task.data?.title ?? task.name,
    due: task.data?.due ?? null,
    recurrence: task.data?.recurrence ?? null,
    lists: (task.data?.lists ?? []).map(listName),
    reminders: task.data?.reminders ?? [],
    body: task.body,
  };
}

/** "[[Focus]]" -> "Focus"; a bare value passes through. */
function listName(link: string): string {
  const trimmed = link.trim();
  return trimmed.startsWith("[[") && trimmed.endsWith("]]")
    ? trimmed.slice(2, -2)
    : trimmed;
}

/** The per-line input back to plain list names. */
function parseLists(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(listName)
    .filter((name) => name !== "");
}

/** Reminder datetimes, one per line. */
function parseReminders(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The route decodes params, and a SAF uri already carries percent
 * escapes of its own, so the id can arrive once or twice decoded.
 * Compare every form the route may hand back.
 */
function findTask(tasks: TaskItem[], id: string): TaskItem | undefined {
  return (
    tasks.find((task) => task.id === id) ??
    tasks.find((task) => decode(task.id) === id) ??
    tasks.find((task) => task.id === decode(id))
  );
}

/**
 * The editor writes task frontmatter, so only a note whose kind is the
 * tasks wikilink may open in it. Save on any other note would rewrite
 * a deed or a plain note as a task.
 */
function isTaskNote(task: TaskItem): boolean {
  const kind: unknown = task.data?.kind;
  return kind === "[[tasks]]";
}

export default function TaskEditorScreen() {
  const params = useLocalSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId ?? "";
  const tasks = useTaskList();
  const { status } = useStoreMeta();
  const insets = useSafeAreaInsets();

  const task = React.useMemo(() => findTask(tasks, id), [tasks, id]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {task == null ? (
        <>
          <EditorHeader />
          <View style={styles.holder}>
            <Text style={styles.empty}>
              {status === "loading"
                ? "Loading task..."
                : "That task is no longer here."}
            </Text>
          </View>
        </>
      ) : isTaskNote(task) ? (
        // Keyed by id: another task remounts the form, so the draft
        // seeds from the task on screen and never needs resetting.
        <TaskEditorForm key={task.id} task={task} />
      ) : (
        <NoteViewer key={task.id} task={task} />
      )}
    </View>
  );
}

/** Cancel always; Save only where there is a task to write. */
function EditorHeader({
  saving = false,
  canSave = false,
  showSave = true,
  onSave,
}: {
  saving?: boolean;
  canSave?: boolean;
  showSave?: boolean;
  onSave?: () => void;
}) {
  const blocked = saving || !canSave;
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [pressed && styles.pressed]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="cancel editing"
      >
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>
      <View style={styles.headerSpacer} />
      {showSave ? (
        <Pressable
          style={({ pressed }) => [
            styles.save,
            pressed && !blocked && styles.savePressed,
            blocked && styles.saveDisabled,
          ]}
          onPress={onSave}
          disabled={blocked}
          accessibilityRole="button"
          accessibilityLabel="save task"
        >
          <Text style={styles.saveText}>{saving ? "Saving" : "Save"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Frontmatter as the reader shows it: keys in file order with their
 * values, lists joined on one line. The vault parser already reads
 * the block between the --- fences, so a non-task note keeps every
 * property it carries.
 */
function frontmatterEntries(text: string): [string, string][] {
  const { values } = parseFrontmatter("", text);
  return Object.entries(values).map(([key, value]): [string, string] => [
    key,
    Array.isArray(value) ? value.join(", ") : value ?? "",
  ]);
}

/**
 * A note that is not a task has no task fields to edit. It opens
 * read-only: its name, its frontmatter as plain pairs, and its body,
 * with no Save to rewrite it.
 */
function NoteViewer({ task }: { task: TaskItem }) {
  const entries = React.useMemo(
    () => frontmatterEntries(task.text),
    [task.text],
  );
  return (
    <>
      <EditorHeader showSave={false} />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.noteTitle}>{task.name}</Text>
        <Text style={styles.noteHint}>
          This note is not a task, so it opens read-only.
        </Text>
        <View style={styles.properties}>
          {entries.map(([key, value]) => (
            <View key={key} style={styles.propertyRow}>
              <Text style={styles.propertyKey}>{key}</Text>
              <Text style={styles.propertyValue}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.noteBody}>{task.body}</Text>
      </ScrollView>
    </>
  );
}

function TaskEditorForm({ task }: { task: TaskItem }) {
  const actions = useTaskActions();
  // Seeded at mount and never reset: a failed save keeps every
  // keystroke.
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
      await actions.edit(task, edit, openedText);
      router.back();
    } catch (caught) {
      // The draft stays put: the user fixes what the write refused.
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  };

  return (
    <>
      <EditorHeader
        saving={saving}
        canSave={draft.name.trim() !== ""}
        onSave={() => void save()}
      />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error != null ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Field
          label="Name"
          value={draft.name}
          onChangeText={(name) => change({ name })}
          placeholder="Task name"
          autoCapitalize="sentences"
          autoCorrect
          editable={!saving}
        />
        <Field
          label="Due"
          value={draft.due ?? ""}
          onChangeText={(due) => change({ due: due.trim() === "" ? null : due })}
          placeholder="2026-10-21 or 2026-10-21T15:00"
          editable={!saving}
        />
        <Field
          label="Recurrence"
          value={draft.recurrence ?? ""}
          onChangeText={(recurrence) =>
            change({
              recurrence: recurrence.trim() === "" ? null : recurrence,
            })
          }
          placeholder="FREQ=WEEKLY"
          editable={!saving}
        />
        <Field
          label="Lists"
          value={listsText}
          onChangeText={(text) => {
            setListsText(text);
            change({ lists: parseLists(text) });
          }}
          placeholder={"Focus\nErrands"}
          hint="One list name per line."
          multiline
          editable={!saving}
        />
        <Field
          label="Reminders"
          value={remindersText}
          onChangeText={(text) => {
            setRemindersText(text);
            change({ reminders: parseReminders(text) });
          }}
          placeholder={"2026-10-21T09:00\n2026-10-21T18:30"}
          hint="One datetime per line."
          multiline
          editable={!saving}
        />
        <Field
          label="Body"
          value={draft.body}
          onChangeText={(body) => change({ body })}
          placeholder="Notes"
          autoCapitalize="sentences"
          autoCorrect
          multiline
          editable={!saving}
        />
      </ScrollView>
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  multiline,
  editable,
  autoCapitalize = "none",
  autoCorrect = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  editable: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        selectionColor={colors.accent}
      />
      {hint != null ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: pageGutter,
    paddingVertical: spacing.m,
    gap: spacing.s,
  },
  headerSpacer: {
    flex: 1,
  },
  cancel: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  pressed: {
    opacity: 0.6,
  },
  save: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.l,
    borderRadius: radius,
    backgroundColor: colors.accent,
  },
  savePressed: {
    backgroundColor: colors.accentDeep,
  },
  saveDisabled: {
    backgroundColor: colors.pressed,
  },
  saveText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.onAccent,
  },
  body: {
    flex: 1,
  },
  content: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    paddingHorizontal: pageGutter,
    paddingBottom: spacing.xxxl,
  },
  noteTitle: {
    marginTop: spacing.l,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.ink,
  },
  noteHint: {
    marginTop: spacing.s,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  properties: {
    marginTop: spacing.l,
    gap: spacing.xs,
  },
  propertyRow: {
    flexDirection: "row",
    gap: spacing.s,
  },
  propertyKey: {
    minWidth: 96,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.inkMuted,
  },
  propertyValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  noteBody: {
    marginTop: spacing.xl,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  field: {
    marginTop: spacing.l,
    gap: spacing.xs,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.inkMuted,
  },
  input: {
    minHeight: 40,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  inputMultiline: {
    minHeight: 96,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },
  errorBanner: {
    marginTop: spacing.l,
    padding: spacing.m,
    borderRadius: radius,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.danger,
  },
  holder: {
    paddingHorizontal: pageGutter,
    paddingTop: spacing.xl,
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
});
