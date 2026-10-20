import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { BottomBar } from "../../components/BottomBar";
import { loadMockTasks, toggleMockCompleted } from "../../lib/mock";
import { addDays, parseStoredDate, startOfDay } from "../../lib/dates";
import { colors, fonts, spacing, radii } from "../../theme/tokens";

/**
 * Variant B Planner tab, mock-driven for the design exploration.
 * Day mode is the hero: a big serif date header like a notebook page,
 * tasks beneath with soft separators. Month and Week are compact
 * data views; swiping is ticket 0012.
 */
type Mode = "day" | "week" | "month";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TARGETS: CaptureTarget[] = [{ kind: "main" }];

export default function PlannerScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mode, setMode] = React.useState<Mode>("day");
  const [selected, setSelected] = React.useState(() => startOfDay(new Date()));
  const [sheetOpen, setSheetOpen] = React.useState(false);

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

  const all = tasks ?? [];
  const groups = groupByDue(all, new Date());
  const open = [...groups.overdue, ...groups.today, ...groups.undated];
  for (const bucket of groups.upcoming) {
    open.push(...bucket.items);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Subtle 7-day strip: today first, a dot marks days with tasks. */}
        <DayStrip
          selected={selected}
          tasks={open}
          onSelect={setSelected}
        />

        {/* Month / Week / Day toggle; Day is the default landing. */}
        <View style={styles.segmented}>
          {(["month", "week", "day"] as Mode[]).map((option) => (
            <Pressable
              key={option}
              style={({ pressed }) => [
                styles.segment,
                mode === option && styles.segmentActive,
                pressed && styles.pressedFill,
              ]}
              onPress={() => setMode(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === option }}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === option && styles.segmentTextActive,
                ]}
              >
                {option === "day" ? "Day" : option === "week" ? "Week" : "Month"}
              </Text>
            </Pressable>
          ))}
        </View>

        {status === "loading" ? <LoadingState /> : null}
        {status === "error" ? (
          <EmptyState label="Something went wrong. Pull to retry." />
        ) : null}

        {status === "ready" && mode === "day" ? (
          <DaySpread
            date={selected}
            today={new Date()}
            tasks={all}
            onToggle={toggle}
          />
        ) : null}
        {status === "ready" && mode === "week" ? (
          <WeekView tasks={open} today={new Date()} selected={selected} />
        ) : null}
        {status === "ready" && mode === "month" ? (
          <MonthView tasks={open} today={new Date()} />
        ) : null}
      </ScrollView>

      <BottomBar onAdd={() => setSheetOpen(true)} />
      {sheetOpen ? (
        <CaptureSheet
          visible
          targets={TARGETS}
          defaultTargetIndex={0}
          preselectedDue={isoOf(selected)}
          onClose={() => setSheetOpen(false)}
          onSend={() => setSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------- day */

function DaySpread({
  date,
  today,
  tasks,
  onToggle,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  onToggle: (task: TaskItem) => void;
}) {
  const sameDay = startOfDay(today).getTime() === startOfDay(date).getTime();
  const groups = groupByDue(tasks, today);
  const overdue = sameDay ? groups.overdue : [];
  const todayTasks = sameDay ? groups.today : tasksForDay(tasks, date);

  // Timed tasks first, then untimed; a paper planner reads top to bottom.
  const timed = todayTasks.filter(hasTime);
  const untimed = todayTasks.filter((task) => !hasTime(task));
  const rows = [...timed, ...untimed];

  return (
    <View>
      <Text style={styles.dateMonth}>
        {MONTHS[date.getMonth()]} {date.getFullYear()}
      </Text>
      <Text style={styles.dateHeader}>
        {WEEKDAYS_FULL[date.getDay()]} {date.getDate()}
      </Text>
      <View style={styles.dateRule} />

      {overdue.length > 0 ? (
        <View style={styles.overdueBlock}>
          <Text style={styles.overdueLabel}>Overdue  {overdue.length}</Text>
          {overdue.map((task) => (
            <TaskRow key={task.uri} task={task} onToggle={onToggle} />
          ))}
        </View>
      ) : null}

      {rows.length > 0 ? (
        <View style={styles.dayCard}>
          {rows.map((task, index) => (
            <View
              key={task.uri}
              style={index > 0 ? styles.dayRow : styles.dayRowFirst}
            >
              <TaskRow task={task} onToggle={onToggle} timeAlign="right" />
            </View>
          ))}
        </View>
      ) : null}

      {overdue.length === 0 && rows.length === 0 ? (
        <EmptyState label="Nothing scheduled." />
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- week */

function WeekView({
  tasks,
  today,
  selected,
}: {
  tasks: TaskItem[];
  today: Date;
  selected: Date;
}) {
  const todayStart = startOfDay(today).getTime();
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));
  return (
    <View>
      {days.map((day) => {
        const items = tasksForDay(tasks, day);
        const isToday = startOfDay(day).getTime() === todayStart;
        return (
          <View
            key={day.getTime()}
            style={[
              styles.weekRow,
              startOfDay(day).getTime() === startOfDay(selected).getTime()
                ? styles.weekRowSelected
                : null,
            ]}
          >
            <View style={styles.weekDay}>
              <Text style={styles.weekDayName}>
                {WEEKDAYS[day.getDay()]}
              </Text>
              <Text style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}>
                {day.getDate()}
              </Text>
            </View>
            <View style={styles.weekTasks}>
              {items.length > 0 ? (
                items.map((task) => (
                  <Text key={task.uri} style={styles.weekTask} numberOfLines={1}>
                    {hasTime(task) ? `${timeOf(task)}  ` : ""}
                    {task.name}
                  </Text>
                ))
              ) : (
                <Text style={styles.weekFree}>-</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- month */

function MonthView({ tasks, today }: { tasks: TaskItem[]; today: Date }) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const lead = monthStart.getDay();
  const busy = new Set(
    tasks
      .map((task) => (task.data?.due ? parseStoredDate(task.data.due) : null))
      .filter((due) => due != null)
      .map((due) => isoOf(due!.date)),
  );
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(today.getFullYear(), today.getMonth(), index + 1),
    ),
  ];
  return (
    <View style={styles.monthCard}>
      <View style={styles.monthHead}>
        {WEEKDAYS.map((name) => (
          <Text key={name} style={styles.monthHeadCell}>
            {name[0]}
          </Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {cells.map((day, index) =>
          day == null ? (
            <View key={`blank-${index}`} style={styles.monthCell} />
          ) : (
            <View
              key={day.getTime()}
              style={[
                styles.monthCell,
                isSameDay(day, today) && styles.monthCellToday,
              ]}
            >
              <Text style={[styles.monthNum, isSameDay(day, today) && styles.monthNumToday]}>
                {day.getDate()}
              </Text>
              {busy.has(isoOf(day)) ? <View style={styles.monthDot} /> : null}
            </View>
          ),
        )}
      </View>
    </View>
  );
}

/* ----------------------------------------------------------- helpers */

function DayStrip({
  selected,
  tasks,
  onSelect,
}: {
  selected: Date;
  tasks: TaskItem[];
  onSelect: (date: Date) => void;
}) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(new Date(), offset));
  const busy = new Set(
    tasks
      .map((task) => (task.data?.due ? parseStoredDate(task.data.due) : null))
      .filter((due) => due != null)
      .map((due) => isoOf(due!.date)),
  );
  return (
    <View style={styles.strip}>
      {days.map((day) => {
        const active = isSameDay(day, selected);
        return (
          <Pressable
            key={day.getTime()}
            style={({ pressed }) => [
              styles.stripDay,
              active && styles.stripDayActive,
              pressed && styles.pressedFill,
            ]}
            onPress={() => onSelect(day)}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
          >
            <Text style={[styles.stripName, active && styles.stripNameActive]}>
              {WEEKDAYS[day.getDay()]}
            </Text>
            <Text
              style={[
                styles.stripNum,
                active && styles.stripNumActive,
                !active && busy.has(isoOf(day)) ? styles.stripNumBusy : null,
              ]}
            >
              {day.getDate()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function tasksForDay(tasks: TaskItem[], day: Date): TaskItem[] {
  const iso = isoOf(day);
  return tasks.filter(
    (task) =>
      task.data?.due != null &&
      task.data.due.slice(0, 10) === iso &&
      !(task.data?.completed != null && task.data.completed !== ""),
  );
}

function hasTime(task: TaskItem): boolean {
  return task.data?.due ? (parseStoredDate(task.data.due)?.hasTime ?? false) : false;
}

function timeOf(task: TaskItem): string {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  if (!due) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(due.date.getHours())}:${pad(due.date.getMinutes())}`;
}

function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function LoadingState() {
  return (
    <View style={styles.holder}>
      <View style={[styles.skeleton, { width: "60%" as const, height: 28 }]} />
      <View style={[styles.skeleton, { width: "85%" as const }]} />
      <View style={[styles.skeleton, { width: "70%" as const }]} />
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
  pressedFill: {
    backgroundColor: colors.pressed,
  },

  // 7-day strip
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.m,
    marginBottom: spacing.l,
  },
  stripDay: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 52,
    borderRadius: radii.m,
  },
  stripDayActive: {
    backgroundColor: colors.ink,
  },
  stripName: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  stripNameActive: {
    color: colors.onAccent,
  },
  stripNum: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
    marginTop: 2,
  },
  stripNumActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },
  stripNumBusy: {
    fontWeight: "600",
  },

  // segmented toggle
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 3,
    marginBottom: spacing.xl,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.s,
  },
  segmentActive: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  segmentTextActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },

  // day spread, the hero
  dateMonth: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },
  dateHeader: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: fonts.display,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  dateRule: {
    height: 2,
    backgroundColor: colors.accent,
    width: 40,
    marginTop: spacing.m,
    marginBottom: spacing.l,
    borderRadius: 1,
  },
  overdueBlock: {
    marginBottom: spacing.l,
  },
  overdueLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: spacing.xs,
  },
  dayRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  dayRowFirst: {},

  // week view
  weekRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: radii.m,
    minHeight: 44,
  },
  weekRowSelected: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  weekDay: {
    width: 44,
  },
  weekDayName: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  weekDayNum: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  weekDayNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  weekTasks: {
    flex: 1,
    gap: spacing.xs,
  },
  weekTask: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  weekFree: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },

  // month view
  monthCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.m,
  },
  monthHead: {
    flexDirection: "row",
  },
  monthHeadCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthCell: {
    width: "14.28%" as const,
    aspectRatio: 1.1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  monthCellToday: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.m,
  },
  monthNum: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  monthNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  monthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },

  // states
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
