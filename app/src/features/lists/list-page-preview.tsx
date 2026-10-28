import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PreviewRow } from "@/components/preview-row";
import type { SortMode } from "@/lib/settings";
import {
  useTabTasks,
  useTaskSections,
  type SectionTone,
} from "@/stores/tasks/selectors";
import {
  colors,
  fonts,
  measure,
  pageGutter,
  radius,
  spacing,
} from "@/theme/tokens";
import type { TaskItem } from "@/types/task";

/**
 * The peek at another list tab while a swipe carries the finger
 * toward it: the groups and cards the lists screen draws, rendered
 * still. It is a picture of the page's first screenful, so nothing
 * here takes input and nothing scrolls.
 */
type PreviewSection = {
  title: string;
  tone: SectionTone | "faint";
  data: TaskItem[];
};

export function ListPagePreview({
  tab,
  sortMode,
}: {
  tab: string;
  sortMode: SortMode;
}) {
  const shown = useTabTasks(tab);
  const visible = React.useMemo(
    () => shown.filter((task) => (task.errors?.length ?? 0) === 0),
    [shown],
  );
  const openSections = useTaskSections(visible, sortMode);
  const completed = React.useMemo(
    () =>
      visible
        .filter((task) => task.data?.completed)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visible],
  );

  // The screen's own sections, built the same way: the open groups in
  // due order, then one quiet Completed group.
  const sections = React.useMemo<PreviewSection[]>(() => {
    const next: PreviewSection[] = openSections.map((section) => ({
      title: section.title,
      tone: section.tone,
      data: section.items,
    }));
    if (completed.length > 0) {
      next.push({ title: "Completed", tone: "faint", data: completed });
    }
    return next;
  }, [openSections, completed]);

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.content}>
        {sections.map((section) => (
          <View key={section.title} style={styles.group}>
            <Text
              style={
                section.tone === "faint"
                  ? [styles.completedLabel, styles.dimmed]
                  : [styles.groupLabel, toneLabel(section.tone)]
              }
            >
              {section.title}
              {"  "}
              {section.data.length}
            </Text>
            {section.data.map((task, index) => (
              <View
                key={task.uri}
                style={[
                  styles.cardRow,
                  index === 0 && styles.cardFirst,
                  index === section.data.length - 1 && styles.cardLast,
                  section.tone === "faint" && styles.completedRow,
                ]}
              >
                {index > 0 ? <View style={styles.cardDivider} /> : null}
                <View style={styles.rowMain}>
                  <PreviewRow
                    task={task}
                    done={task.data?.completed != null}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const toneLabel = (() => {
  const map = StyleSheet.create({
    danger: { color: colors.danger },
    muted: { color: colors.inkMuted },
    ink: { color: colors.accent },
  });
  return (tone: SectionTone) => map[tone];
})();

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  // The same page grid the scroller uses, so the peek lines up with
  // the page it becomes.
  content: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    paddingHorizontal: pageGutter,
    paddingTop: spacing.m,
  },
  group: {
    marginTop: spacing.xl,
  },
  groupLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingBottom: spacing.s,
  },
  completedRow: {
    opacity: 0.55,
  },
  // The screen dims its Completed header as a whole; the label alone
  // carries that here, since the rows below it dim one by one.
  dimmed: {
    opacity: 0.55,
  },
  completedLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkFaint,
    paddingBottom: spacing.xs,
  },
  // One card per group: the sides on every row, the top and its radii
  // on the first, the bottom on the last.
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  rowMain: {
    flex: 1,
  },
  cardFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
  },
  cardLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
  },
  cardDivider: {
    position: "absolute" as const,
    left: spacing.l + 24 + spacing.m,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
});
