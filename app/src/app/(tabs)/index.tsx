import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useVault } from "../../hooks/useVault";
import { onMain, groupByDue, type TaskItem } from "../../features/tasks/query";
import { setCompleted } from "../../features/tasks/mutate";
import { writeCapture, type CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { FloatingCaptureButton } from "../../components/FloatingCaptureButton";
import { dayLabel, parseStoredDate } from "../../lib/dates";

/**
 * Lists tab. 0009 ships the Main list working; the real list tab bar
 * is ticket 0010.
 */
export default function ListsScreen() {
  const { rootUri, tasksDir, tasks, status, grant, refresh } = useVault();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const targets: CaptureTarget[] = [{ kind: "main" }];

  const main = onMain(tasks);
  const groups = groupByDue(main, new Date());

  const toggle = async (task: TaskItem) => {
    const done = task.data?.completed != null && task.data.completed !== "";
    await setCompleted(task, !done);
    await refresh();
  };

  const send = async (
    parsed: Parameters<typeof writeCapture>[1],
    target: CaptureTarget,
  ) => {
    if (!tasksDir) {
      return;
    }
    await writeCapture(tasksDir, parsed, target);
    await refresh();
  };

  if (!rootUri) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.status}>{status}</Text>
        <Pressable style={styles.grant} onPress={grant}>
          <Text style={styles.grantText}>Grant vault folder</Text>
        </Pressable>
      </View>
    );
  }

  const sections: { title: string; items: TaskItem[]; red?: boolean }[] = [
    { title: "Past", items: groups.overdue, red: true },
    { title: "Today", items: groups.today },
    ...groups.upcoming.map((bucket) => ({
      title: dayLabel(bucket.date, new Date()),
      items: bucket.items,
    })),
    { title: "No date", items: groups.undated },
  ];
  const timed = (task: TaskItem) =>
    task.data?.due ? (parseStoredDate(task.data.due)?.hasTime ?? false) : false;

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={[{ key: "header" }]}
        renderItem={() => (
          <View>
            <Text style={styles.header}>Main</Text>
            <Text style={styles.status}>{status}</Text>
            {sections
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <View key={section.title}>
                  <Text style={[styles.section, section.red && styles.sectionRed]}>
                    {section.title}
                  </Text>
                  {section.items.map((task) => (
                    <TaskRow
                      key={task.uri}
                      task={{ ...task, name: timed(task) ? task.name : task.name }}
                      onToggle={toggle}
                    />
                  ))}
                </View>
              ))}
            {groups.completed.length > 0 ? (
              <View>
                <Text style={styles.sectionCompleted}>
                  Completed ({groups.completed.length})
                </Text>
                {groups.completed.map((task) => (
                  <TaskRow key={task.uri} task={task} onToggle={toggle} />
                ))}
              </View>
            ) : null}
            {main.length === 0 && groups.completed.length === 0 ? (
              <Text style={styles.empty}>Nothing yet. Tap + to add a task.</Text>
            ) : null}
          </View>
        )}
      />
      <FloatingCaptureButton onPress={() => setSheetOpen(true)} />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
  },
  status: {
    color: "#777777",
    marginBottom: 8,
  },
  section: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a4b8f",
    marginTop: 16,
    marginBottom: 4,
  },
  sectionRed: {
    color: "#b3261e",
  },
  sectionCompleted: {
    fontSize: 15,
    fontWeight: "600",
    color: "#999999",
    marginTop: 20,
  },
  empty: {
    color: "#777777",
    marginTop: 24,
  },
  grant: {
    backgroundColor: "#1d3fbf",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  grantText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
