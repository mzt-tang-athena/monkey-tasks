import * as React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import type { ParsedCapture } from "../../features/capture/parse";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { InlineComposer } from "../../components/InlineComposer";
import { BottomBar } from "../../components/BottomBar";
import { loadMockTasks, toggleMockCompleted } from "../../lib/mock";
import { addDays, parseStoredDate, startOfDay } from "../../lib/dates";
import { colors, fonts, spacing, radii } from "../../theme/tokens";

/**
 * Variant F Planner tab, mock-driven for the design exploration.
 * Day mode is the hero: the strongest serif date header of the three
 * variants, an hour-ruler timeline with tasks sitting at their times,
 * and an unscheduled tray docked at the bottom of the spread. Undated
 * tasks wait in the tray; tapping one opens the capture sheet with
 * the selected day preselected, standing in for drag-to-schedule.
 * Week mode is a wide canvas of day columns with real content.
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

/** The ruler runs 07:00 to 21:00; a paper planner's waking hours. */
const FIRST_HOUR = 7;
const LAST_HOUR = 21;

const TARGETS: CaptureTarget[] = [{ kind: "main" }];

export default function PlannerScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mode, setMode] = React.useState<Mode>("day");
  const [selected, setSelected] = React.useState(() => startOfDay(new Date()));
  const [sheetTask, setSheetTask] = React.useState<TaskItem | null>(null);

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

  // The inline composer appends to the mock list in place. On the
  // planner, a capture with no parsed date lands on the selected day.
  const send = (parsed: ParsedCapture) => {
    const due = parsed.due ?? isoOf(selected);
    setTasks((current) => [
      {
        uri: `mock://vault/Tasks/${parsed.name}.md`,
        fileName: `${parsed.name}.md`,
        name: parsed.name,
        text: "",
        data: {
          kind: "[[tasks]]",
          created: new Date().toISOString().slice(0, 10),
          due,
        },
        body: "",
      },
      ...(current ?? []),
    ]);
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
              accessibilityLabel={option === "day" ? "Day mode" : option === "week" ? "Week mode" : "Month mode"}
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
            onSchedule={setSheetTask}
          />
        ) : null}
        {status === "ready" && mode === "week" ? (
          <WeekView tasks={open} today={new Date()} selected={selected} />
        ) : null}
        {status === "ready" && mode === "month" ? (
          <MonthView tasks={open} today={new Date()} />
        ) : null}
      </ScrollView>

      <InlineComposer
        targets={TARGETS}
        defaultTargetIndex={0}
        preselectedDue={mode === "day" ? isoOf(selected) : undefined}
        onSend={send}
      />
      <BottomBar />
      {sheetTask ? (
        <CaptureSheet
          visible
          targets={TARGETS}
          defaultTargetIndex={0}
          preselectedDue={isoOf(selected)}
          onClose={() => setSheetTask(null)}
          onSend={() => setSheetTask(null)}
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
  onSchedule,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  onToggle: (task: TaskItem) => void;
  onSchedule: (task: TaskItem) => void;
}) {
  const sameDay = startOfDay(today).getTime() === startOfDay(date).getTime();
  const groups = groupByDue(tasks, today);
  const overdue = sameDay ? groups.overdue : [];
  const dayTasks = sameDay ? groups.today : tasksForDay(tasks, date);

  // Timed tasks slot into their hour; untimed tasks gather under
  // Anytime below the ruler, the way a paper planner reads.
  const timed = dayTasks.filter(hasTime);
  const untimed = dayTasks.filter((task) => !hasTime(task));
  const tray = groups.undated;

  const hours: number[] = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
    hours.push(hour);
  }

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

      <Text style={styles.sectionLabel}>Timeline</Text>
      <View style={styles.timeline}>
        {hours.map((hour) => {
          const slot = timed.filter(
            (task) => parseStoredDate(task.data?.due ?? "")?.date.getHours() === hour,
          );
          return (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{`${String(hour).padStart(2, "0")}:00`}</Text>
              <View style={styles.hourLane}>
                {slot.length > 0
                  ? slot.map((task) => (
                      <TaskRow
                        key={task.uri}
                        task={task}
                        onToggle={onToggle}
                      />
                    ))
                  : (
                    <View style={styles.dropHint}>
                      <Text style={styles.dropHintText}>drop here</Text>
                    </View>
                  )}
              </View>
            </View>
          );
        })}
      </View>

      {untimed.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>Anytime  {untimed.length}</Text>
          {untimed.map((task) => (
            <TaskRow key={task.uri} task={task} onToggle={onToggle} />
          ))}
        </View>
      ) : null}

      {/* The unscheduled tray: undated tasks waiting to be dragged up
          onto the timeline. Drag is ticketed; the tray and its drop
          targets are the visual contract. */}
      <UnscheduledTray
        tasks={tray}
        onSchedule={onSchedule}
      />
    </View>
  );
}

function UnscheduledTray({
  tasks,
  onSchedule,
}: {
  tasks: TaskItem[];
  onSchedule: (task: TaskItem) => void;
}) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <View style={styles.tray}>
      <Text style={styles.trayLabel}>Unscheduled  {tasks.length}</Text>
      <Text style={styles.trayHint}>
        Waiting for a day. Drag one onto the timeline.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trayRow}
      >
        {tasks.map((task) => (
          <Pressable
            key={task.uri}
            style={({ pressed }) => [
              styles.trayChip,
              pressed && styles.trayChipPressed,
            ]}
            onPress={() => onSchedule(task)}
            accessibilityRole="button"
            accessibilityLabel={`schedule ${task.name}`}
          >
            <View style={styles.grip}>
              <View style={styles.gripLine} />
              <View style={styles.gripLine} />
            </View>
            <Text style={styles.trayChipText} numberOfLines={1}>
              {task.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
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
  const selectedStart = startOfDay(selected).getTime();
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));
  return (
    // A wider canvas: seven real columns, like the desk wall calendar.
    // Phones scroll sideways; tablets and desktop see the whole week.
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.weekCanvas}>
        {days.map((day) => {
          const items = tasksForDay(tasks, day);
          const isToday = startOfDay(day).getTime() === todayStart;
          const isSelected = startOfDay(day).getTime() === selectedStart;
          return (
            <View
              key={day.getTime()}
              style={[
                styles.weekColumn,
                isSelected ? styles.weekColumnSelected : null,
              ]}
            >
              <View style={[styles.weekHead, isToday ? styles.weekHeadToday : null]}>
                <Text
                  style={[
                    styles.weekDayName,
                    isToday ? styles.weekDayNameToday : null,
                  ]}
                >
                  {WEEKDAYS[day.getDay()]}
                </Text>
                <Text
                  style={[
                    styles.weekDayNum,
                    isToday ? styles.weekDayNumToday : null,
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>
              <View style={styles.weekTasks}>
                {items.length > 0 ? (
                  items.map((task) => (
                    <View key={task.uri} style={styles.weekChip}>
                      {hasTime(task) ? (
                        <Text style={styles.weekChipTime}>{timeOf(task)}</Text>
                      ) : null}
                      <Text style={styles.weekChipName} numberOfLines={2}>
                        {task.name}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.weekFree}>-</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
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
    paddingBottom: spacing.xxl,
  },
  pressedFill: {
    backgroundColor: colors.pressed,
  },

  // 7-day strip
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.m,
    marginBottom: spacing.xl,
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
    marginBottom: spacing.air,
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

  // day spread, the hero: the strongest serif header of the round
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
    fontSize: 44,
    lineHeight: 54,
    fontFamily: fonts.display,
    color: colors.ink,
    marginTop: spacing.s,
  },
  dateRule: {
    height: 3,
    backgroundColor: colors.accent,
    width: 56,
    marginTop: spacing.m,
    marginBottom: spacing.xl,
    borderRadius: 1.5,
  },
  overdueBlock: {
    marginBottom: spacing.xl,
  },
  overdueLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.inkMuted,
    marginBottom: spacing.m,
  },

  // hour-ruler timeline
  timeline: {
    marginBottom: spacing.air,
  },
  hourRow: {
    flexDirection: "row",
    minHeight: 72,
  },
  hourLabel: {
    width: 52,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    fontVariant: ["tabular-nums"],
    paddingTop: spacing.xs,
  },
  hourLane: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  dropHint: {
    minHeight: 40,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairline,
    borderRadius: radii.s,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.s,
  },
  dropHintText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    letterSpacing: 0.5,
  },

  // unscheduled tray
  tray: {
    backgroundColor: colors.pressed,
    borderRadius: radii.l,
    padding: spacing.l,
    marginTop: spacing.air,
  },
  trayLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  trayHint: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  trayRow: {
    gap: spacing.s,
    alignItems: "center",
  },
  trayChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    paddingLeft: spacing.s,
    paddingRight: spacing.l,
    paddingVertical: spacing.s,
    minHeight: 44,
    maxWidth: 260,
  },
  trayChipPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  grip: {
    flexDirection: "row",
    gap: 3,
    marginRight: spacing.s,
  },
  gripLine: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: colors.inkFaint,
  },
  trayChipText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
  },

  // week view: a wider canvas of day columns
  weekCanvas: {
    flexDirection: "row",
    gap: spacing.s,
  },
  weekColumn: {
    width: 220,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.l,
    padding: spacing.s,
  },
  weekColumnSelected: {
    borderColor: colors.accent,
  },
  weekHead: {
    borderRadius: radii.m,
    alignItems: "center",
    paddingVertical: spacing.s,
    marginBottom: spacing.s,
  },
  weekHeadToday: {
    backgroundColor: colors.accentSoft,
  },
  weekDayName: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  weekDayNameToday: {
    color: colors.accent,
    fontWeight: "600",
  },
  weekDayNum: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fonts.display,
    color: colors.ink,
    marginTop: 2,
  },
  weekDayNumToday: {
    color: colors.accent,
  },
  weekTasks: {
    gap: spacing.s,
    minHeight: 120,
  },
  weekChip: {
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.s,
    padding: spacing.s,
  },
  weekChipTime: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    marginBottom: 2,
  },
  weekChipName: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  weekFree: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    textAlign: "center",
    marginTop: spacing.xl,
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
