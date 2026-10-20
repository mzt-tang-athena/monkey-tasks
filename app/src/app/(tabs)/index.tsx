import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { InlineComposer } from "../../components/InlineComposer";
import { BottomBar } from "../../components/BottomBar";
import {
  inMockFocus,
  inMockMain,
  loadMockTasks,
  toggleMockCompleted,
} from "../../lib/mock";
import { dayLabel } from "../../lib/dates";
import { colors, fonts, spacing, radii, measure } from "../../theme/tokens";

/**
 * Variant D Lists tab, mock-driven for the design exploration.
 * The list tab bar sits at the very top, the brain breathes between
 * plain group headers, and capture is the inline composer docked
 * above the bottom bar.
 */
type ListTab = "Focus" | "Main";

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus", uri: "mock://vault/Tasks/Lists/Focus.md" },
  { kind: "main" },
];

export default function ListsScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [tab, setTab] = React.useState<ListTab>("Main");
  const [draft, setDraft] = React.useState<{
    text: string;
    targetIndex: number;
  } | null>(null);

  // Mock load. Status changes only in async callbacks, so the effect
  // does not set state synchronously. Loading starts as the initial
  // state, and the error state stays a real code path.
  React.useEffect(() => {
    let cancelled = false;
    loadMockTasks()
      .then((loaded) => {
        if (!cancelled) {
          setTasks(loaded);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (task: TaskItem) => {
    setTasks((current) =>
      (current ?? []).map((item) =>
        item.uri === task.uri ? toggleMockCompleted(item) : item,
      ),
    );
  };

  const visible = inTabTasks(tasks, tab);
  const groups = groupByDue(visible, new Date());

  const sections: {
    title: string;
    items: TaskItem[];
    tone: "danger" | "muted" | "ink";
  }[] = [
    { title: "Past", items: groups.overdue, tone: "danger" },
    { title: "Today", items: groups.today, tone: "ink" },
    ...groups.upcoming.map((bucket) => ({
      title: dayLabel(bucket.date, new Date()),
      items: bucket.items,
      tone: "muted" as const,
    })),
    { title: "No date", items: groups.undated, tone: "muted" },
  ];
  const shown = sections.filter((section) => section.items.length > 0);

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <FlatList
          contentContainerStyle={styles.content}
          data={[{ key: "lists" }]}
          renderItem={() => (
            <View>
              {/* Clean top: the list tab bar, nothing above it. */}
              <View style={styles.tabBar}>
                {(["Focus", "Main"] as ListTab[]).map((name) => (
                  <Pressable
                    key={name}
                    style={({ pressed }) => [
                      styles.tabChip,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => setTab(name)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === name }}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        tab === name && styles.tabTextActive,
                      ]}
                    >
                      {name}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.count}>{visible.length} open</Text>
              </View>

              {status === "loading" ? <LoadingState /> : null}
              {status === "error" ? (
                <EmptyState label="Something went wrong. Pull to retry." />
              ) : null}
              {status === "ready" && shown.length === 0 ? (
                <EmptyState label="Nothing on this list yet." />
              ) : null}

              {status === "ready"
                ? shown.map((section) => (
                    <View key={section.title} style={styles.group}>
                      <Text
                        style={[styles.groupLabel, toneLabel(section.tone)]}
                      >
                        {section.title}
                        {"  "}
                        {section.items.length}
                      </Text>
                      {section.items.map((task, index) => (
                        <View
                          key={task.uri}
                          style={index > 0 ? styles.groupRow : undefined}
                        >
                          <TaskRow task={task} onToggle={toggle} />
                        </View>
                      ))}
                    </View>
                  ))
                : null}

              {status === "ready" && groups.completed.length > 0 ? (
                <View style={[styles.group, styles.completedGroup]}>
                  <Text style={styles.completedLabel}>
                    Completed  {groups.completed.length}
                  </Text>
                  {groups.completed.map((task, index) => (
                    <View
                      key={task.uri}
                      style={index > 0 ? styles.groupRow : undefined}
                    >
                      <TaskRow task={task} onToggle={toggle} />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />
      </View>

      {/* Persistent inline composer, docked above the bottom bar. */}
      <InlineComposer
        targets={TARGETS}
        defaultTargetIndex={tab === "Focus" ? 0 : 1}
        onSend={() => undefined}
        onOpenDetails={(text, targetIndex) =>
          setDraft(text.trim() ? { text, targetIndex } : null)
        }
      />
      <BottomBar />
      {draft ? (
        <CaptureSheet
          visible
          targets={TARGETS}
          defaultTargetIndex={draft.targetIndex}
          initialText={draft.text}
          onClose={() => setDraft(null)}
          onSend={() => setDraft(null)}
        />
      ) : null}
    </View>
  );
}

function inTabTasks(tasks: TaskItem[] | null, tab: ListTab): TaskItem[] {
  const all = tasks ?? [];
  return tab === "Focus" ? inMockFocus(all) : inMockMain(all);
}

const toneLabel = (() => {
  const map = StyleSheet.create({
    danger: { color: colors.danger },
    muted: { color: colors.inkMuted },
    ink: { color: colors.accent },
  });
  return (tone: "danger" | "muted" | "ink") => map[tone];
})();

function LoadingState() {
  return (
    <View style={styles.holder}>
      <View style={[styles.skeleton, { width: "40%" as const }]} />
      <View style={[styles.skeleton, { width: "70%" as const }]} />
      <View style={[styles.skeleton, { width: "55%" as const }]} />
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.holder}>
      <Text style={styles.empty}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  body: {
    flex: 1,
  },
  content: {
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    padding: spacing.l,
    paddingBottom: spacing.xl,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    marginBottom: spacing.l,
  },
  tabChip: {
    minHeight: 36,
    paddingHorizontal: spacing.s,
    justifyContent: "center",
  },
  chipPressed: {
    backgroundColor: colors.pressed,
    borderRadius: radii.m,
  },
  tabText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: colors.accent,
  },
  count: {
    marginLeft: "auto" as const,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },

  // Plain groups: a header on the paper, flush rows beneath.
  group: {
    marginTop: spacing.l,
  },
  groupLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingBottom: spacing.xs,
  },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  completedGroup: {
    opacity: 0.55,
    marginTop: spacing.xl,
  },
  completedLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.inkFaint,
    paddingBottom: spacing.xs,
  },

  // States
  holder: {
    minHeight: 160,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  skeleton: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.hairline,
    marginVertical: spacing.m,
  },
  empty: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
