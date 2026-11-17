import * as React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { NoteChangedError } from "@/lib/vault/notes";
import { splitNote } from "@/lib/inbox-notes/model";
import type { InboxNote } from "@/lib/inbox-notes/model";
import { vaultIdle } from "@/lib/vault/read-gate";
import { useVault } from "@/lib/vault/vault-provider";
import { useCreateNote } from "@/stores/inbox-notes/mutations/use-create-note";
import { useSaveNote } from "@/stores/inbox-notes/mutations/use-save-note";
import { useInboxNotes } from "@/stores/inbox-notes/use-inbox-notes";
import {
  measure,
  pageGutter,
  radius,
  spacing,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

// The browser's own outline fights the editor's caret on web.
const noFocusOutline = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});

type Phase = "loading" | "ready" | "error";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function closeEditor() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/inbox");
  }
}

/** The note route: one encoded vault uri segment. */
export default function NoteEditorScreen() {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const uri = raw == null ? "" : decodeURIComponent(raw);
  const inbox = useInboxNotes();
  const note = inbox.notes.find((held) => held.uri === uri) ?? null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {note == null ? (
        <>
          <EditorBar saving={false} canSave={false} onSave={() => {}} />
          <View style={styles.holder}>
            <Text style={styles.empty}>
              {inbox.status === "loading"
                ? "Opening note..."
                : "That note is no longer in Inbox."}
            </Text>
          </View>
        </>
      ) : (
        <NoteEditor key={note.uri} note={note} />
      )}
    </View>
  );
}

/**
 * The editor. It reads the file fresh on open, so the guard compares
 * against the text the user actually saw. The frontmatter is an opaque
 * head; only the body is editable.
 */
function NoteEditor({ note }: { note: InboxNote }) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { adapter } = useVault();
  const client = useQueryClient();
  const saveNote = useSaveNote();
  const create = useCreateNote();

  const [phase, setPhase] = React.useState<Phase>("loading");
  const [text, setText] = React.useState("");
  const [head, setHead] = React.useState("");
  const [body, setBody] = React.useState("");
  const [openedBody, setOpenedBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const read = React.useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      // The read joins the vault queue, so it never lands over a write.
      await vaultIdle(client);
      const next = await adapter.read(note.uri);
      const parts = splitNote(next);
      setText(next);
      setHead(parts.head);
      setBody(parts.body);
      setOpenedBody(parts.body);
      setConflict(false);
      setPhase("ready");
    } catch (caught) {
      setError(messageOf(caught));
      setPhase("error");
    }
  }, [adapter, client, note.uri]);

  React.useEffect(() => {
    void read();
  }, [read]);

  const canSave = phase === "ready" && !saving && body !== openedBody;

  const save = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveNote({
        uri: note.uri,
        fileName: note.fileName,
        head,
        body,
        expected: text,
      });
      closeEditor();
    } catch (caught) {
      if (caught instanceof NoteChangedError) {
        setConflict(true);
      } else {
        setError(messageOf(caught));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveCopy = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await create({ title: "", body });
      closeEditor();
    } catch (caught) {
      setConflict(false);
      setError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <EditorBar saving={saving} canSave={canSave} onSave={() => void save()} />
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={spacing.l}
      >
        <Text style={styles.title}>{note.title}</Text>

        {conflict ? (
          <View style={styles.conflict} role="alert">
            <Text style={styles.conflictTitle}>This note changed</Text>
            <Text style={styles.conflictText}>
              Another app changed this note after you opened it. Nothing was
              overwritten.
            </Text>
            <View style={styles.conflictActions}>
              <Button
                variant="text"
                label="Save a copy"
                accessibilityLabel="save a copy of the draft"
                onPress={() => void saveCopy()}
              />
              <Button
                variant="text"
                label="Reload note"
                accessibilityLabel="reload the note, discarding the draft"
                onPress={() => void read()}
              />
              <Button
                variant="text"
                label="Keep editing"
                accessibilityLabel="keep editing the draft"
                onPress={() => setConflict(false)}
              />
            </View>
          </View>
        ) : null}

        {error != null ? (
          <Banner
            tone="danger"
            lines={[error]}
            actions={[
              {
                label: phase === "error" ? "Retry" : "Retry save",
                accessibilityLabel:
                  phase === "error" ? "retry opening the note" : "retry saving the note",
                onPress: () => {
                  if (phase === "error") {
                    void read();
                  } else {
                    void save();
                  }
                },
              },
            ]}
          />
        ) : null}

        {phase === "loading" ? (
          <Text style={styles.empty}>Opening note...</Text>
        ) : phase === "error" ? null : (
          <TextInput
            style={[styles.body, noFocusOutline]}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            placeholder="Write a note"
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.accent}
            accessibilityLabel="note body"
            editable={!saving}
          />
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

/** Cancel and Save, on the page grid. */
function EditorBar({
  saving,
  canSave,
  onSave,
}: {
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.bar}>
      <Button
        variant="text"
        tone="muted"
        label="Cancel"
        accessibilityLabel="cancel editing"
        onPress={closeEditor}
      />
      <View style={styles.spacer} />
      <Button
        label={saving ? "Saving" : "Save"}
        accessibilityLabel="save note"
        onPress={onSave}
        disabled={saving || !canSave}
        busy={saving}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    bar: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: pageGutter,
      paddingVertical: spacing.m,
      gap: spacing.s,
    },
    spacer: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      maxWidth: measure,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: pageGutter,
      paddingBottom: spacing.xxxl,
      gap: spacing.l,
    },
    title: {
      ...type.title,
      fontWeight: "600",
      color: colors.ink,
    },
    holder: {
      paddingHorizontal: pageGutter,
      paddingTop: spacing.xl,
    },
    empty: {
      ...type.body,
      color: colors.inkMuted,
    },
    conflict: {
      gap: spacing.xs,
      padding: spacing.m,
      borderRadius: radius,
      backgroundColor: colors.dangerSoft,
    },
    conflictTitle: {
      ...type.control,
      fontWeight: "600",
      color: colors.danger,
    },
    conflictText: {
      ...type.meta,
      color: colors.danger,
    },
    conflictActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.s,
    },
    body: {
      ...type.body,
      minHeight: 280,
      color: colors.ink,
      padding: spacing.m,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.surface,
    },
  }),
});
