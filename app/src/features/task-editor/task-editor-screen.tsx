import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStoreMeta, useTaskList } from "@/stores/tasks/task-state";
import { fonts, pageGutter, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { EditorHeader } from "./components/editor-header";
import { NoteViewer } from "./components/note-viewer";
import { TaskEditorForm } from "./components/task-editor-form";
import { findTask, isTaskNote } from "./lib/draft";

/**
 * The task editor route: it looks the task up by the route's id and
 * picks the form for a task note or the read-only viewer for any other
 * note.
 */
export default function TaskEditorScreen() {
  const { styles } = useThemedStyles(makeStyles);
  const params = useLocalSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId ?? "";
  const tasks = useTaskList();
  const { status } = useStoreMeta();
  const insets = useSafeAreaInsets();

  const task = React.useMemo(() => findTask(tasks, id), [tasks, id]);

  return (
    <View testID="editor-screen" style={[styles.screen, { paddingTop: insets.top }]}>
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
