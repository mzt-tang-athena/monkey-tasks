import * as React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useVault } from "../../hooks/useVault";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import { setCompleted } from "../../features/tasks/mutate";
import { writeCapture, type CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { FloatingCaptureButton } from "../../components/FloatingCaptureButton";
import { dayLabel, todayIso } from "../../lib/dates";

/**
 * Planner tab, Day mode. 0009 ships today's spread; month and week
 * modes and swiping are ticket 0012.
 */
export default function PlannerScreen() {
  const { rootUri, tasksDir, tasks, status, refresh } = useVault();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const targets: CaptureTarget[] = [{ kind: "main" }];

  const groups = groupByDue(tasks, new Date());

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
    // Capturing from a day spread preselects that day as due.
    await writeCapture(tasksDir, parsed, target, todayIso());
    await refresh();
  };

  if (!rootUri) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.status}>{status}</Text>
      </View>
    );
  }

  const now = new Date();
  const sections: { title: string; items: TaskItem[]; red?: boolean }[] = [
    { title: "Overdue", items: groups.overdue, red: true },
    { title: dayLabel(now, now), items: groups.today },
    ...groups.upcoming.slice(0, 7).map((bucket) => ({
      title: dayLabel(bucket.date, now),
      items: bucket.items,
    })),
  ];

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={[{ key: "header" }]}
        renderItem={() => (
          <View>
            <Text style={styles.status}>{status}</Text>
            {sections
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <View key={section.title}>
                  <Text style={[styles.section, section.red && styles.sectionRed]}>
                    {section.title}
                  </Text>
                  {section.items.map((task) => (
                    <TaskRow key={task.uri} task={task} onToggle={toggle} />
                  ))}
                </View>
              ))}
            {groups.overdue.length === 0 && groups.today.length === 0 ? (
              <Text style={styles.empty}>Nothing scheduled. Enjoy the calm.</Text>
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
          preselectedDue={todayIso()}
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
  empty: {
    color: "#777777",
    marginTop: 24,
  },
});
