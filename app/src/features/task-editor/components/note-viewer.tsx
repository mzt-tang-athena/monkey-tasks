import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MotionScrollView } from "@/components/motion/scroll-view";
import type { TaskItem } from "@/types/task";
import { colors, fonts, measure, pageGutter, spacing } from "@/theme/tokens";
import { frontmatterEntries } from "../lib/draft";
import { EditorHeader } from "./editor-header";

/**
 * A note that is not a task has no task fields to edit. It opens
 * read-only: its name, its frontmatter as plain pairs, and its body,
 * with no Save to rewrite it.
 */
export function NoteViewer({ task }: { task: TaskItem }) {
  const entries = React.useMemo(
    () => frontmatterEntries(task.text),
    [task.text],
  );
  return (
    <>
      <EditorHeader showSave={false} />
      <MotionScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={styles.head}>
            <Text style={styles.title}>{task.name}</Text>
            <Text style={styles.hint}>
              This note is not a task, so it opens read-only.
            </Text>
          </View>
          <View style={styles.properties}>
            {entries.map(([key, value]) => (
              <View key={key} style={styles.property}>
                <Text style={styles.key}>{key}</Text>
                <Text style={styles.value}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.body}>{task.body}</Text>
      </MotionScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // The head and properties, then the body a step further.
  content: {
    maxWidth: measure,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: pageGutter,
    paddingTop: spacing.l,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  top: {
    gap: spacing.l,
  },
  head: {
    gap: spacing.s,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.ink,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  properties: {
    gap: spacing.xs,
  },
  property: {
    flexDirection: "row",
    gap: spacing.s,
  },
  key: {
    minWidth: 96,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.inkMuted,
  },
  value: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.body,
    color: colors.ink,
  },
});
