import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import type { ParsedCapture } from "../../features/capture/parse";
import { TaskRow } from "../../components/TaskRow";
import { InlineComposer } from "../../components/InlineComposer";
import { BottomBar } from "../../components/BottomBar";
import {
  inMockFocus,
  inMockMain,
  loadMockTasks,
  toggleMockCompleted,
} from "../../lib/mock";
import { dayLabel } from "../../lib/dates";
import { colors, fonts, spacing } from "../../theme/tokens";

/**
 * Variant F Lists tab, mock-driven for the design exploration.
 * The clean Variant B top stays: list tabs at the very top, no
 * announcement header. Groups are plain uppercase headers on paper,
 * not cards, with a full breath of air between groups. Capture is
 * the inline composer docked above the bottom bar.
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

  // The inline composer appends to the mock list in place; the real
  // write path is ticketed separately.
  const send = (parsed: ParsedCapture, target: CaptureTarget) => {
    setTasks((current) => [
      {
        uri: `mock://vault/Tasks/${parsed.name}.md`,
        fileName: `${parsed.name}.md`,
        name: parsed.name,
        text: "",
        data: {
          kind: "[[tasks]]",
          created: new Date().toISOString().slice(0, 10),
          due: parsed.due ?? undefined,
          lists:
            target.kind === "list" ? [`[[${target.name}]]`] : undefined,
        },
        body: "",
      },
      ...(current ?? []),
    ]);
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
              ? shown.map((section, sectionIndex) => (
                  <View
                    key={section.title}
                    style={
                      sectionIndex > 0
                        ? styles.group
                        : styles.groupFirst
                    }
                  >
                    <Text style={[styles.groupLabel, toneLabel(section.tone)]}>
                      {section.title}
                      {"  "}
                      {section.items.length}
                    </Text>
                    {section.items.map((task) => (
                      <TaskRow key={task.uri} task={task} onToggle={toggle} />
                    ))}
                  </View>
                ))
              : null}

            {status === "ready" && groups.completed.length > 0 ? (
              <View style={[styles.group, styles.completedGroup]}>
                <Text style={styles.completedLabel}>
                  Completed  {groups.completed.length}
                </Text>
                {groups.completed.map((task) => (
                  <TaskRow key={task.uri} task={task} onToggle={toggle} />
                ))}
              </View>
            ) : null}
          </View>
        )}
      />
      <InlineComposer
        targets={TARGETS}
        defaultTargetIndex={tab === "Focus" ? 0 : 1}
        onSend={send}
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
    padding: spacing.l,
    paddingBottom: spacing.xxl,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  tabChip: {
    minHeight: 40,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    justifyContent: "center",
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

  // Plain headers: no cards, rows sit straight on the paper. A full
  // breath of air separates the groups; this is the variant's calm.
  group: {
    marginTop: spacing.air,
  },
  groupFirst: {
    marginTop: spacing.s,
  },
  completedGroup: {
    opacity: 0.6,
  },
  groupLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
  },
  completedLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.inkFaint,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
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
