import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { inList, onMain, groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { BottomNavbar } from "../../components/BottomNavbar";
import { dayLabel } from "../../lib/dates";
import { t } from "../../theme/tokens";
import { useMockTasks } from "../../lib/mock";

/**
 * Lists tab, design variant C. Open tasks render as elevated cards,
 * one per date group; completed tasks fade to the bottom. Mock
 * driven: data comes from the fixture shaped like the vault model.
 */
export default function ListsScreen() {
  const { tasks, loading, error, toggle, capture } = useMockTasks();
  const [list, setList] = React.useState<"Focus" | "Main">("Main");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const visible = list === "Main" ? onMain(tasks) : inList(tasks, "Focus");
  const groups = groupByDue(visible, new Date());
  const focusCount = countOpen(inList(tasks, "Focus"));
  const mainCount = countOpen(onMain(tasks));

  const targets: CaptureTarget[] = [
    { kind: "main" },
    { kind: "list", name: "Focus", uri: "mock://lists/Focus.md" },
  ];

  const send = (
    parsed: Parameters<typeof capture>[0],
    target: CaptureTarget,
  ) => {
    capture(parsed, target.kind === "list" ? target.name : null);
  };

  const sections: { label: string; items: TaskItem[]; danger?: boolean }[] = [
    { label: "Past", items: groups.overdue, danger: true },
    { label: "Today", items: groups.today },
    ...groups.upcoming.map((bucket) => ({
      label: dayLabel(bucket.date, new Date()),
      items: bucket.items,
    })),
    { label: "No date", items: groups.undated },
  ];
  const shown = sections.filter((section) => section.items.length > 0);
  const empty = !loading && !error && tasks.length === 0;

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={[{ key: "content" }]}
        renderItem={() => (
          <View>
            {error ? <StatusCard text={error} danger /> : null}
            {loading ? <LoadingSkeleton /> : null}
            {empty ? <Text style={styles.empty}>Nothing yet. Tap + to add a task.</Text> : null}
            {!loading && !error && !empty ? (
              <View>
                <Text style={styles.title}>Tasks</Text>
                <View style={styles.tabs}>
                  <ListTab
                    name="Focus"
                    count={focusCount}
                    active={list === "Focus"}
                    onPress={() => setList("Focus")}
                  />
                  <ListTab
                    name="Main"
                    count={mainCount}
                    active={list === "Main"}
                    onPress={() => setList("Main")}
                  />
                </View>
                {shown.map((section) => (
                  <View key={section.label} style={styles.group}>
                    <Text style={[styles.groupLabel, section.danger && styles.groupLabelDanger]}>
                      {section.label}
                    </Text>
                    <View style={styles.card}>
                      {section.items.map((task, index) => (
                        <TaskRow
                          key={task.uri}
                          task={task}
                          onToggle={toggle}
                          divider={index < section.items.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                {groups.completed.length > 0 ? (
                  <View style={styles.group}>
                    <Text style={styles.groupLabelCompleted}>
                      Completed ({groups.completed.length})
                    </Text>
                    <View style={[styles.card, styles.cardFaded]}>
                      {groups.completed.map((task, index) => (
                        <TaskRow
                          key={task.uri}
                          task={task}
                          onToggle={toggle}
                          divider={index < groups.completed.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      />
      <BottomNavbar active="lists" onCapture={() => setSheetOpen(true)} />
      {sheetOpen ? (
        <CaptureSheet
          visible
          targets={targets}
          defaultTargetIndex={0}
          onClose={() => setSheetOpen(false)}
          onSend={send}
        />
      ) : null}
    </View>
  );
}

function ListTab({
  name,
  count,
  active,
  onPress,
}: {
  name: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`list ${name}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && !active && styles.tabPressed,
      ]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{name}</Text>
      <Text style={[styles.tabCount, active && styles.tabCountActive]}>{count}</Text>
    </Pressable>
  );
}

function StatusCard({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.statusText, danger && styles.statusTextDanger]}>{text}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View>
      {[0, 1].map((block) => (
        <View key={block} style={[styles.card, styles.skeletonCard]}>
          <View style={[styles.bar, styles.barWide]} />
          <View style={[styles.bar, styles.barMid]} />
          <View style={[styles.bar, styles.barNarrow]} />
        </View>
      ))}
    </View>
  );
}

function countOpen(items: TaskItem[]): number {
  return items.filter((item) => !(item.data?.completed != null && item.data.completed !== ""))
    .length;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.colors.surface,
  },
  content: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xl,
    paddingBottom: 140,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: t.colors.text,
    fontFamily: t.fonts.sans,
    marginBottom: t.spacing.lg,
  },
  tabs: {
    flexDirection: "row",
    gap: t.spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
    marginBottom: t.spacing.xl,
  },
  tab: {
    paddingBottom: t.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: t.colors.accent,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
  },
  tabLabelActive: {
    color: t.colors.text,
  },
  tabCount: {
    fontSize: 13,
    color: t.colors.textFaint,
    fontFamily: t.fonts.sans,
    marginTop: t.spacing.xxs,
  },
  tabCountActive: {
    color: t.colors.accent,
  },
  group: {
    marginBottom: t.spacing.xl,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
    marginBottom: t.spacing.sm,
  },
  groupLabelDanger: {
    color: t.colors.danger,
  },
  groupLabelCompleted: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    color: t.colors.textFaint,
    fontFamily: t.fonts.sans,
    marginBottom: t.spacing.sm,
  },
  card: {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: "hidden",
  },
  cardFaded: {
    opacity: 0.55,
  },
  statusText: {
    color: t.colors.textMuted,
    fontSize: 15,
    fontFamily: t.fonts.sans,
    padding: t.spacing.lg,
  },
  statusTextDanger: {
    color: t.colors.danger,
  },
  empty: {
    color: t.colors.textMuted,
    fontSize: 15,
    fontFamily: t.fonts.sans,
    marginTop: t.spacing.xl,
  },
  skeletonCard: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
    marginBottom: t.spacing.xl,
  },
  bar: {
    height: 12,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.surfaceActive,
  },
  barWide: {
    width: "70%",
  },
  barMid: {
    width: "48%",
  },
  barNarrow: {
    width: "32%",
  },
});
