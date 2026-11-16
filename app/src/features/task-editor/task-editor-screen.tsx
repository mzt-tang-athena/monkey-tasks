import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { useTaskEditor } from "@/hooks/use-task-editor";
import { useStoreMeta, useTaskList } from "@/stores/tasks/task-state";
import { fonts, pageGutter, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { EditorHeader } from "./components/editor-header";
import { NoteViewer } from "./components/note-viewer";
import { findTask, isTaskNote } from "./lib/draft";

/**
 * The note route. A note that is not a task opens read-only. A task
 * has no screen of its own (ADR 20261116-task-editor-sheet): an alert
 * tap lands here, so the route opens the task in the editor sheet and
 * steps back to the screen below it.
 */
export default function TaskEditorScreen() {
  const { styles } = useThemedStyles(makeStyles);
  const params = useLocalSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId ?? "";
  const tasks = useTaskList();
  const { status } = useStoreMeta();
  const insets = useSafeAreaInsets();
  const editor = useTaskEditor();

  const task = React.useMemo(() => findTask(tasks, id), [tasks, id]);
  const editorId = task != null && isTaskNote(task) ? task.id : null;

  const handOff = useStableCallback((taskId: string) => {
    editor.open(taskId);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  });

  React.useEffect(() => {
    if (editorId != null) {
      handOff(editorId);
    }
  }, [editorId, handOff]);

  return (
    <View testID="editor-screen" style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {editorId != null ? null : task == null ? (
        <>
          <EditorHeader />
          <View style={styles.holder}>
            <Text style={styles.empty}>
              {status === "loading"
                ? "Loading note..."
                : "That note is no longer here."}
            </Text>
          </View>
        </>
      ) : (
        <NoteViewer key={task.id} task={task} />
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.paper,
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
  }),
});
