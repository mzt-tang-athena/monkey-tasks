import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { BottomBar } from "../../components/BottomBar";
import {
  inMockFocus,
  inMockMain,
  loadMockTasks,
  toggleMockCompleted,
} from "../../lib/mock";
import { dayLabel } from "../../lib/dates";
import { colors, fonts, spacing, radii } from "../../theme/tokens";

/**
 * Variant E Lists tab, mock-driven for the design exploration.
 * The list tabs sit alone at the very top. Groups are plain headers
 * over hairline-separated rows: no cards, the paper carries them.
 * Capture is the persistent inline composer above the bottom bar.
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
      <FlatList
        contentContainerStyle={styles.content}
        data={[{ key: "lists" }]}
        renderItem={() => (
          <View>
            {/* The only chrome at the top: the list tabs, nothing else. */}
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
                    style={[styles.tabText, tab === name && styles.tabTextActive]}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
              <Text style={styles.count}>
                {visible.length} open
              </Text>
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
                    <Text style={[styles.groupLabel, toneLabel(section.tone)]}>
                      {section.title}
                      {"  "}
                      {section.items.length}
                    </Text>
                    <View style={styles.rows}>
                      {section.items.map((task, index) => (
                        <View
                          key={task.uri}
                          style={index > 0 ? styles.groupRow : styles.groupRowFirst}
                        >
                          <TaskRow task={task} onToggle={toggle} />
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              : null}

            {status === "ready" && groups.completed.length > 0 ? (
              <View style={[styles.group, styles.completedGroup]}>
                <Text style={styles.completedLabel}>
                  Completed  {groups.completed.length}
                </Text>
                <View style={styles.rows}>
                  {groups.completed.map((task, index) => (
                    <View
                      key={task.uri}
                      style={index > 0 ? styles.groupRow : styles.groupRowFirst}
                    >
                      <TaskRow task={task} onToggle={toggle} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}
      />
      <CaptureSheet
        targets={TARGETS}
        defaultTargetIndex={tab === "Focus" ? 0 : 1}
        onSend={() => undefined}
      />
      <BottomBar />
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
    ink: { color: colors.ink },
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
  content: {
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.s,
  },
  tabChip: {
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    justifyContent: "center",
    borderRadius: radii.s,
  },
  chipPressed: {
    backgroundColor: colors.pressed,
  },
  tabText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  count: {
    marginLeft: "auto" as const,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },

  // Plain groups: a header, then hairline rows. No cards.
  group: {
    marginTop: spacing.l,
  },
  groupLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xs,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  groupRowFirst: {},
  completedGroup: {
    opacity: 0.65,
    marginBottom: spacing.l,
  },
  completedLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkFaint,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xs,
  },
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
    marginHorizontal: spacing.l,
  },
  empty: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
