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
 * Variant B Lists tab, mock-driven for the design exploration.
 * Date groups are understated cards, not plain headers. The capture
 * affordance lives in the slim bottom bar.
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
  const [sheetOpen, setSheetOpen] = React.useState(false);
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
  }, []);  const toggle = (task: TaskItem) => {
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
                  <View
                    key={section.title}
                    style={styles.groupCard}
                  >
                    <Text style={[styles.groupLabel, toneLabel(section.tone)]}>
                      {section.title}
                      {"  "}
                      {section.items.length}
                    </Text>
                    {section.items.map((task, index) => (
                      <View
                        key={task.uri}
                        style={
                          index > 0 ? styles.groupRow : styles.groupRowFirst
                        }
                      >
                        <TaskRow task={task} onToggle={toggle} />
                      </View>
                    ))}
                  </View>
                ))
              : null}

            {status === "ready" && groups.completed.length > 0 ? (
              <View style={[styles.groupCard, styles.completedCard]}>
                <Text style={styles.completedLabel}>
                  Completed  {groups.completed.length}
                </Text>
                {groups.completed.map((task, index) => (
                  <View
                    key={task.uri}
                    style={
                      index > 0 ? styles.groupRow : styles.groupRowFirst
                    }
                  >
                    <TaskRow task={task} onToggle={toggle} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      />
      <BottomBar onAdd={() => setSheetOpen(true)} />
      {sheetOpen ? (
        <CaptureSheet
          visible
          targets={TARGETS}
          defaultTargetIndex={tab === "Focus" ? 0 : 1}
          onClose={() => setSheetOpen(false)}
          onSend={() => setSheetOpen(false)}
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
    padding: spacing.l,
    paddingBottom: spacing.xl,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    marginTop: spacing.xl,
    marginBottom: spacing.l,
  },
  tabChip: {
    minHeight: 40,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    justifyContent: "center",
    borderRadius: radii.m,
  },
  chipPressed: {
    backgroundColor: colors.pressed,
  },
  tabText: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.ink,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: colors.accent,
  },
  count: {
    marginLeft: "auto" as const,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    marginTop: spacing.m,
    paddingVertical: spacing.s,
  },
  completedCard: {
    opacity: 0.6,
    marginTop: spacing.xl,
  },
  groupLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xs,
    paddingBottom: spacing.s,
  },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  groupRowFirst: {},
  completedLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkFaint,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xs,
    paddingBottom: spacing.s,
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
