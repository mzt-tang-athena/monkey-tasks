import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { ParsedCapture } from "../../features/capture/parse";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow, TaskRowSkeleton } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { FloatingCaptureButton } from "../../components/FloatingCaptureButton";
import { countOpen, mockLists, mockTasks, taskFromCapture } from "../../lib/mock";
import { dayLabel, todayIso } from "../../lib/dates";
import { theme } from "../../theme/tokens";

/**
 * Lists tab, variant A. Mock-driven for this design branch: the same
 * TaskItem shape the vault feed produces, held in local state so
 * toggling and capturing stay interactive.
 */
const TARGETS: CaptureTarget[] = [
  { kind: "main" },
  { kind: "list", name: "Focus", uri: "mock://lists/focus" },
];

type Phase = "loading" | "ready" | "error";

export default function ListsScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[]>(mockTasks);
  const [phase, setPhase] = React.useState<Phase>("ready");
  const [active, setActive] = React.useState<string>("Main");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const visible = tasks.filter((task) =>
    active === "Main"
      ? task.data == null || !task.data.lists?.length
      : task.data?.lists?.includes(`[[${active}]]`) ?? false,
  );
  const groups = groupByDue(visible, new Date());

  const toggle = (task: TaskItem) => {
    const done = task.data?.completed != null && task.data.completed !== "";
    const fresh: TaskItem["data"] = {
      kind: "[[tasks]]",
      created: todayIso(),
    };
    const data = { ...(task.data ?? fresh), completed: done ? null : todayIso() };
    setTasks((prev) =>
      prev.map((item) =>
        item.uri === task.uri ? { ...item, data } : item,
      ),
    );
  };

  const send = (parsed: ParsedCapture, target: CaptureTarget) => {
    setTasks((prev) => [...prev, taskFromCapture(parsed, target)]);
  };

  const sections: { title: string; items: TaskItem[]; red?: boolean }[] = [
    { title: "Past", items: groups.overdue, red: true },
    { title: "Today", items: groups.today },
    ...groups.upcoming.map((bucket) => ({
      title: dayLabel(bucket.date, new Date()),
      items: bucket.items,
    })),
    { title: "No date", items: groups.undated },
  ];
  const open = sections.filter((section) => section.items.length > 0);
  const empty = visible.length === 0 && groups.completed.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.tabBar}>
        {mockLists.map((name) => (
          <ListTab
            key={name}
            name={name}
            count={countOpen(tasks, name)}
            selected={name === active}
            onSelect={() => setActive(name)}
          />
        ))}
      </View>
      <FlatList
        contentContainerStyle={styles.content}
        data={[{ key: "body" }]}
        renderItem={() => (
          <View>
            {phase === "loading" ? (
              <View>
                <TaskRowSkeleton />
                <TaskRowSkeleton />
                <TaskRowSkeleton />
              </View>
            ) : null}
            {phase === "error" ? (
              <View style={styles.note}>
                <Text style={styles.noteTitle}>Could not load tasks.</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.retry,
                    pressed && styles.retryPressed,
                  ]}
                  onPress={() => setPhase("ready")}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
            {phase === "ready" && empty ? (
              <Text style={styles.empty}>
                Nothing here. Tap + to add a task.
              </Text>
            ) : null}
            {phase === "ready" &&
              open.map((section) => (
                <View key={section.title}>
                  <Text style={[styles.section, section.red && styles.sectionRed]}>
                    {section.title}
                  </Text>
                  {section.items.map((task) => (
                    <TaskRow key={task.uri} task={task} onToggle={toggle} />
                  ))}
                </View>
              ))}
            {phase === "ready" && groups.completed.length > 0 ? (
              <View>
                <Text style={styles.sectionCompleted}>
                  Completed ({groups.completed.length})
                </Text>
                {groups.completed.map((task) => (
                  <TaskRow key={task.uri} task={task} onToggle={toggle} />
                ))}
              </View>
            ) : null}
          </View>
        )}
      />
      <FloatingCaptureButton onPress={() => setSheetOpen(true)} />
      {sheetOpen ? (
        <CaptureSheet
          visible
          targets={TARGETS}
          defaultTargetIndex={0}
          onClose={() => setSheetOpen(false)}
          onSend={send}
        />
      ) : null}
    </View>
  );
}

/** List tab: label plus open count, accent underline when selected. */
function ListTab({
  name,
  count,
  selected,
  onSelect,
}: {
  name: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`show ${name}`}
      onPress={onSelect}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      <Text
        style={[
          styles.tabText,
          selected ? styles.tabTextActive : styles.tabTextInactive,
        ]}
      >
        {name}
        {count > 0 ? `  ${count}` : ""}
      </Text>
      <View
        style={[styles.tabUnderline, selected && styles.tabUnderlineActive]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.paper,
    flex: 1,
  },
  tabBar: {
    backgroundColor: theme.colors.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    gap: theme.spacing[5],
    paddingHorizontal: theme.spacing[4],
  },
  tab: {
    paddingTop: theme.spacing[2],
  },
  tabPressed: {
    opacity: 0.6,
  },
  tabText: {
    fontSize: theme.type.body.fontSize,
    fontWeight: theme.weights.medium,
  },
  tabTextActive: {
    color: theme.colors.text,
    fontWeight: theme.weights.bold,
  },
  tabTextInactive: {
    color: theme.colors.textMuted,
  },
  tabUnderline: {
    backgroundColor: "transparent",
    height: 2,
    marginTop: theme.spacing[1],
  },
  tabUnderlineActive: {
    backgroundColor: theme.colors.accent,
  },
  content: {
    paddingBottom: 96,
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[2],
  },
  section: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro.fontSize,
    fontWeight: theme.weights.semibold,
    letterSpacing: 0.6,
    marginBottom: theme.spacing[1],
    marginTop: theme.spacing[5],
    textTransform: "uppercase",
  },
  sectionRed: {
    color: theme.colors.danger,
  },
  sectionCompleted: {
    color: theme.colors.textFaint,
    fontSize: theme.type.micro.fontSize,
    fontWeight: theme.weights.semibold,
    letterSpacing: 0.6,
    marginBottom: theme.spacing[1],
    marginTop: theme.spacing[8],
    textTransform: "uppercase",
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.type.small.fontSize,
    marginTop: theme.spacing[6],
  },
  note: {
    alignItems: "flex-start",
    gap: theme.spacing[3],
    marginTop: theme.spacing[6],
  },
  noteTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.type.small.fontSize,
  },
  retry: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  retryPressed: {
    backgroundColor: theme.colors.accentPressed,
  },
  retryText: {
    color: theme.colors.onAccent,
    fontSize: theme.type.small.fontSize,
    fontWeight: theme.weights.semibold,
  },
});
