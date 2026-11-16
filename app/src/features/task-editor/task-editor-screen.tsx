import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTaskList } from "@/stores/tasks/task-state";
import { fonts, pageGutter, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { EditorHeader } from "./components/editor-header";
import { NoteViewer } from "./components/note-viewer";
import { findTask, isTaskNote } from "./lib/draft";

/**
 * The note screen. A note that is not a task opens read-only. A task
 * has no screen of its own any more: it opens in the editor sheet over
 * the list (ADR 20261116-task-editor-sheet), so this route says so and
 * closes.
 */
export default function TaskEditorScreen() {
  const { styles } = useThemedStyles(makeStyles);
  const params = useLocalSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId ?? "";
  const tasks = useTaskList();
  const insets = useSafeAreaInsets();

  const task = React.useMemo(() => findTask(tasks, id), [tasks, id]);

  return (
    <View testID="editor-screen" style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {task != null && isTaskNote(task) ? (
        <>
          <EditorHeader />
          <View style={styles.holder}>
            <Text style={styles.empty}>
              This task opens in the editor over its list.
            </Text>
          </View>
        </>
      ) : task == null ? (
        <>
          <EditorHeader />
          <View style={styles.holder}>
            <Text style={styles.empty}>That note is no longer here.</Text>
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
