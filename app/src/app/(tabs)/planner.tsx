import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { ParsedCapture } from "../../features/capture/parse";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow, TaskRowSkeleton } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { FloatingCaptureButton } from "../../components/FloatingCaptureButton";
import { mockTasks, taskFromCapture } from "../../lib/mock";
import {
  addDays,
  dayLabel,
  formatLocal,
  parseStoredDate,
  startOfDay,
} from "../../lib/dates";
import { theme } from "../../theme/tokens";

/**
 * Planner tab, variant A. Day mode is the default landing; a 7-day
 * strip navigates between days. Week and Month modes are out of this
 * design branch, so they render disabled. Mock-driven: the same
 * TaskItem shape the vault feed produces, held in local state.
 */
const TARGETS: CaptureTarget[] = [{ kind: "main" }];

const MODES = ["Day", "Week", "Month"] as const;
type Mode = (typeof MODES)[number];
type Phase = "loading" | "ready" | "error";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function PlannerScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[]>(mockTasks);
  const [phase, setPhase] = React.useState<Phase>("ready");
  const [mode, setMode] = React.useState<Mode>("Day");
  const [dayOffset, setDayOffset] = React.useState(0);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const now = new Date();
  const selected = addDays(now, dayOffset);
  const selectedStart = startOfDay(selected).getTime();
  const groups = groupByDue(tasks, now);

  const byTime = (a: TaskItem, b: TaskItem) => {
    const ta = a.data?.due ? parseStoredDate(a.data.due) : null;
    const tb = b.data?.due ? parseStoredDate(b.data.due) : null;
    return (ta?.date.getTime() ?? 0) - (tb?.date.getTime() ?? 0);
  };
  const dayTasks = tasks
    .filter((task) => {
      if (task.data?.completed) {
        return false;
      }
      const due = task.data?.due ? parseStoredDate(task.data.due) : null;
      return due != null && startOfDay(due.date).getTime() === selectedStart;
    })
    .sort(byTime);

  const toggle = (task: TaskItem) => {
    const done = task.data?.completed != null && task.data.completed !== "";
    const fresh: TaskItem["data"] = {
      kind: "[[tasks]]",
      created: formatLocal(now, false),
    };
    const data = {
      ...(task.data ?? fresh),
      completed: done ? null : formatLocal(now, false),
    };
    setTasks((prev) =>
      prev.map((item) =>
        item.uri === task.uri ? { ...item, data } : item,
      ),
    );
  };

  const send = (parsed: ParsedCapture, target: CaptureTarget) => {
    // Capturing from a day spread preselects that day as due.
    setTasks((prev) => [
      ...prev,
      taskFromCapture(parsed, target, formatLocal(selected, false)),
    ]);
  };

  const overdueVisible = dayOffset === 0 && groups.overdue.length > 0;
  const empty =
    phase === "ready" && dayTasks.length === 0 && !overdueVisible;

  return (
    <View style={styles.screen}>
      <View style={styles.modes}>
        {MODES.map((name) => (
          <Pressable
            key={name}
            accessibilityLabel={`${name} mode`}
            disabled={name !== "Day"}
            onPress={() => setMode(name)}
            style={({ pressed }) => [
              styles.mode,
              mode === name && styles.modeActive,
              pressed && styles.modePressed,
              name !== "Day" && styles.modeDisabled,
            ]}
          >
            <Text
              style={[
                styles.modeText,
                mode === name && styles.modeTextActive,
              ]}
            >
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
      <DayStrip selected={dayOffset} onSelect={setDayOffset} />
      <FlatList
        contentContainerStyle={styles.content}
        data={[{ key: "body" }]}
        renderItem={() => (
          <View>
            <View style={styles.dateHeader}>
              <Text style={styles.dateTitle}>
                {dayOffset === 0 ? "Today" : dayLabel(selected, now)}
              </Text>
              <Text style={styles.dateCount}>
                {dayTasks.length === 1 ? "1 task" : `${dayTasks.length} tasks`}
              </Text>
            </View>
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
            {phase === "ready" && overdueVisible ? (
              <View>
                <Text style={[styles.section, styles.sectionRed]}>
                  Overdue
                </Text>
                {groups.overdue.map((task) => (
                  <TaskRow key={task.uri} task={task} onToggle={toggle} />
                ))}
              </View>
            ) : null}
            {phase === "ready" && dayTasks.length > 0 ? (
              <View>
                {overdueVisible ? (
                  <Text style={styles.section}>
                    {dayOffset === 0 ? "Today" : dayLabel(selected, now)}
                  </Text>
                ) : null}
                {dayTasks.map((task) => (
                  <TaskRow key={task.uri} task={task} onToggle={toggle} />
                ))}
              </View>
            ) : null}
            {empty ? (
              <Text style={styles.empty}>Nothing scheduled. Enjoy the calm.</Text>
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
          preselectedDue={formatLocal(selected, false)}
          onClose={() => setSheetOpen(false)}
          onSend={send}
        />
      ) : null}
    </View>
  );
}

/** Subtle 7-day strip: weekday letter over the date number. */
function DayStrip({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (offset: number) => void;
}) {
  const now = new Date();
  const offsets = [0, 1, 2, 3, 4, 5, 6];
  return (
    <View style={styles.strip}>
      {offsets.map((offset) => {
        const date = addDays(now, offset);
        const active = offset === selected;
        return (
          <Pressable
            key={offset}
            accessibilityLabel={dayLabel(date, now)}
            onPress={() => onSelect(offset)}
            style={({ pressed }) => [
              styles.dayCell,
              pressed && styles.dayCellPressed,
            ]}
          >
            <Text
              style={[
                styles.dayLetter,
                active && styles.dayLetterActive,
              ]}
            >
              {WEEKDAY_LETTERS[date.getDay()]}
            </Text>
            <View
              style={[styles.dayBubble, active && styles.dayBubbleActive]}
            >
              <Text
                style={[styles.dayNumber, active && styles.dayNumberActive]}
              >
                {date.getDate()}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.paper,
    flex: 1,
  },
  modes: {
    flexDirection: "row",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[2],
  },
  mode: {
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1] + 2,
  },
  modeActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  modePressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  modeDisabled: {
    opacity: 0.4,
  },
  modeText: {
    color: theme.colors.textMuted,
    fontSize: theme.type.small.fontSize,
    fontWeight: theme.weights.medium,
  },
  modeTextActive: {
    color: theme.colors.accent,
    fontWeight: theme.weights.semibold,
  },
  strip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  dayCell: {
    alignItems: "center",
    borderRadius: theme.radii.md,
    flex: 1,
    paddingVertical: theme.spacing[1],
  },
  dayCellPressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  dayLetter: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro.fontSize,
    fontWeight: theme.weights.medium,
  },
  dayLetterActive: {
    color: theme.colors.accent,
    fontWeight: theme.weights.semibold,
  },
  dayBubble: {
    alignItems: "center",
    borderRadius: theme.radii.pill,
    height: 26,
    justifyContent: "center",
    marginTop: theme.spacing[1],
    width: 26,
  },
  dayBubbleActive: {
    backgroundColor: theme.colors.accent,
  },
  dayNumber: {
    color: theme.colors.text,
    fontSize: theme.type.small.fontSize,
    fontWeight: theme.weights.medium,
  },
  dayNumberActive: {
    color: theme.colors.onAccent,
    fontWeight: theme.weights.semibold,
  },
  content: {
    paddingBottom: 96,
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
  },
  dateHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: theme.spacing[2],
    marginBottom: theme.spacing[1],
  },
  dateTitle: {
    color: theme.colors.text,
    fontSize: theme.type.display.fontSize,
    fontWeight: theme.weights.bold,
    lineHeight: theme.type.display.lineHeight,
  },
  dateCount: {
    color: theme.colors.textMuted,
    fontSize: theme.type.small.fontSize,
  },
  section: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro.fontSize,
    fontWeight: theme.weights.semibold,
    letterSpacing: 0.6,
    marginBottom: theme.spacing[1],
    marginTop: theme.spacing[4],
    textTransform: "uppercase",
  },
  sectionRed: {
    color: theme.colors.danger,
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.type.small.fontSize,
    marginTop: theme.spacing[5],
  },
  note: {
    alignItems: "flex-start",
    gap: theme.spacing[3],
    marginTop: theme.spacing[5],
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
