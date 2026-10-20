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
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { BottomBar } from "../../components/BottomBar";
import { loadMockTasks, toggleMockCompleted } from "../../lib/mock";
import { addDays, parseStoredDate, startOfDay } from "../../lib/dates";
import { colors, fonts, spacing, radii } from "../../theme/tokens";

/**
 * Variant E Planner tab, mock-driven for the design exploration.
 * Day mode is the hero: a small serif date header (the one warm
 * gesture), an hour-ruler timeline with tasks set at their times, and
 * an unscheduled tray docked at the bottom. Week is a wide canvas of
 * day columns; Month stays a quiet grid. Swiping is ticket 0012.
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

/** The ruler runs 6 AM to 10 PM; each hour is one fixed slot. */
const FIRST_HOUR = 6;
const LAST_HOUR = 22;
const HOUR_HEIGHT = 56;
const GUTTER = 56;

const TARGETS: CaptureTarget[] = [{ kind: "main" }];

export default function PlannerScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mode, setMode] = React.useState<Mode>("day");
  const [selected, setSelected] = React.useState(() => startOfDay(new Date()));

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

      <CaptureSheet
        targets={TARGETS}
        defaultTargetIndex={0}
        preselectedDue={isoOf(selected)}
        onSend={() => undefined}
      />
      <BottomBar />
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
  const dayTasks = sameDay ? groups.today : tasksForDay(tasks, date);
  // The tray drains only from undated tasks; it is the same pool on
  // every day.
  const tray = groups.undated;

  const timed = dayTasks.filter(hasTime);
  const allDay = dayTasks.filter((task) => !hasTime(task));

  return (
    <View>
      {/* The one warm gesture: a modest serif date, small and functional. */}
      <Text style={styles.dateMonth}>
        {MONTHS[date.getMonth()]} {date.getFullYear()}
      </Text>
      <Text style={styles.dateHeader}>
        {WEEKDAYS_FULL[date.getDay()]} {date.getDate()}
      </Text>

      {overdue.length > 0 ? (
        <View style={styles.overdueBlock}>
          <Text style={styles.overdueLabel}>Overdue  {overdue.length}</Text>
          <View style={styles.rows}>
            {overdue.map((task, index) => (
              <View
                key={task.uri}
                style={index > 0 ? styles.rowDivider : null}
              >
                <TaskRow task={task} onToggle={onToggle} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {allDay.length > 0 ? (
        <View style={styles.allDayBlock}>
          <Text style={styles.blockLabel}>All day</Text>
          <View style={styles.rows}>
            {allDay.map((task, index) => (
              <View
                key={task.uri}
                style={index > 0 ? styles.rowDivider : null}
              >
                <TaskRow task={task} onToggle={onToggle} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <HourRuler date={date} today={today} timed={timed} onToggle={onToggle} />

      {/* Unscheduled tray: undated tasks wait here to be dragged up. */}
      <View style={styles.tray}>
        <View style={styles.trayHead}>
          <Text style={styles.trayLabel}>
            Unscheduled  {tray.length}
          </Text>
          <Text style={styles.trayHint}>Drag up to schedule</Text>
        </View>
        <View style={styles.trayChips}>
          {tray.map((task) => (
            <View key={task.uri} style={styles.trayChip}>
              <View style={styles.grip}>
                <View style={styles.gripDot} />
                <View style={styles.gripDot} />
                <View style={styles.gripDot} />
              </View>
              <Text style={styles.trayChipText} numberOfLines={1}>
                {task.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** The hour ruler: labeled slots, timed tasks set absolutely, a now line. */
function HourRuler({
  date,
  today,
  timed,
  onToggle,
}: {
  date: Date;
  today: Date;
  timed: TaskItem[];
  onToggle: (task: TaskItem) => void;
}) {
  const hours: number[] = [];
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h += 1) {
    hours.push(h);
  }
  const isToday =
    startOfDay(date).getTime() === startOfDay(today).getTime();
  const now = new Date();
  const nowTop =
    (now.getHours() - FIRST_HOUR + now.getMinutes() / 60) * HOUR_HEIGHT;
  const showNow = isToday && now.getHours() >= FIRST_HOUR;

  return (
    <View style={styles.ruler}>
      {hours.map((hour) => (
        <View key={hour} style={styles.hourSlot}>
          <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
          <View style={styles.hourLine} />
        </View>
      ))}
      {timed.map((task) => {
        const due = parseStoredDate(task.data?.due ?? "");
        if (!due) {
          return null;
        }
        // A task before the ruler start clamps to the first slot
        // instead of floating above the ruler.
        const top = Math.max(
          0,
          (due.date.getHours() - FIRST_HOUR + due.date.getMinutes() / 60) *
            HOUR_HEIGHT,
        );
        return (
          <Pressable
            key={task.uri}
            style={({ pressed }) => [
              styles.slotTask,
              { top },
              pressed && styles.slotTaskPressed,
            ]}
            onPress={() => onToggle(task)}
            accessibilityRole="button"
            accessibilityLabel={doneLabel(task)}
          >
            <View style={styles.slotBar} />
            <View style={styles.slotText}>
              <Text style={styles.slotName} numberOfLines={1}>
                {task.name}
              </Text>
              <Text style={styles.slotTime}>
                {formatTime(due.date)}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {showNow ? (
        <View style={[styles.nowLine, { top: nowTop }]} pointerEvents="none">
          <View style={styles.nowDot} />
        </View>
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- week */

/** Week as a wider canvas: seven scrollable day columns. */
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
    <View style={styles.weekCanvasWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.weekCanvas}>
          {days.map((day) => {
            const items = tasksForDay(tasks, day);
            const isToday = startOfDay(day).getTime() === todayStart;
            const isSelected =
              startOfDay(day).getTime() === startOfDay(selected).getTime();
            return (
              <View
                key={day.getTime()}
                style={[
                  styles.weekCol,
                  isSelected ? styles.weekColSelected : null,
                ]}
              >
                <View style={styles.weekHead}>
                  <Text style={styles.weekDayName}>
                    {WEEKDAYS[day.getDay()]}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNum,
                      isToday && styles.weekDayNumToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </View>
                <View style={styles.weekBody}>
                  {items.length > 0 ? (
                    items.map((task) => (
                      <View key={task.uri} style={styles.weekChip}>
                        {hasTime(task) ? (
                          <Text style={styles.weekChipTime}>
                            {timeOf(task)}
                          </Text>
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
    <View style={styles.monthGrid}>
      <View style={styles.monthHead}>
        {WEEKDAYS.map((name) => (
          <Text key={name} style={styles.monthHeadCell}>
            {name[0]}
          </Text>
        ))}
      </View>
      <View style={styles.monthCells}>
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
            {!active && busy.has(isoOf(day)) ? (
              <View style={styles.stripDot} />
            ) : null}
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
  return formatTime(due.date);
}

function hourLabel(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${String(date.getMinutes()).padStart(2, "0")} ${ampm}`;
}

function doneLabel(task: TaskItem): string {
  const done = task.data?.completed != null && task.data.completed !== "";
  return done ? "mark not done" : "mark done";
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
      <View style={[styles.skeleton, { width: "60%" as const, height: 24 }]} />
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
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
  },
  pressedFill: {
    backgroundColor: colors.pressed,
  },

  // 7-day strip
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.l,
    marginBottom: spacing.l,
  },
  stripDay: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 52,
    borderRadius: radii.m,
  },
  stripDayActive: {
    backgroundColor: colors.accent,
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
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
    marginTop: 1,
  },
  stripNumActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },
  stripNumBusy: {
    fontWeight: "600",
  },
  stripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 2,
  },

  // segmented toggle
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.pressed,
    borderRadius: radii.m,
    padding: 2,
    marginHorizontal: spacing.l,
    marginBottom: spacing.xl,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.s,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  segmentText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
  },
  segmentTextActive: {
    color: colors.ink,
    fontWeight: "600",
  },

  // day spread, the hero
  dateMonth: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    paddingHorizontal: spacing.l,
  },
  dateHeader: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.display,
    color: colors.ink,
    paddingHorizontal: spacing.l,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
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
    paddingHorizontal: spacing.l,
    marginBottom: spacing.xs,
  },
  allDayBlock: {
    marginBottom: spacing.l,
  },
  blockLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkMuted,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.xs,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },

  // hour ruler
  ruler: {
    marginHorizontal: spacing.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  hourSlot: {
    flexDirection: "row",
    alignItems: "flex-start",
    height: HOUR_HEIGHT,
  },
  hourLabel: {
    width: GUTTER,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    fontVariant: ["tabular-nums"],
    paddingTop: 0,
    marginTop: -6,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginTop: 2,
  },
  slotTask: {
    position: "absolute",
    left: GUTTER + spacing.s,
    right: spacing.s,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.s,
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 44,
  },
  slotTaskPressed: {
    backgroundColor: colors.pressed,
  },
  slotBar: {
    width: 3,
    backgroundColor: colors.accent,
  },
  slotText: {
    flex: 1,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    justifyContent: "center",
  },
  slotName: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.ink,
    fontWeight: "500",
  },
  slotTime: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  nowLine: {
    position: "absolute",
    left: GUTTER,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    alignItems: "flex-start",
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: -3,
    marginTop: -3,
  },

  // unscheduled tray
  tray: {
    marginTop: spacing.xl,
    backgroundColor: colors.pressed,
    borderRadius: radii.l,
    paddingVertical: spacing.m,
    marginHorizontal: spacing.l,
  },
  trayHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.l,
    marginBottom: spacing.s,
  },
  trayLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkMuted,
  },
  trayHint: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkFaint,
  },
  trayChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s,
    paddingHorizontal: spacing.l,
  },
  trayChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    minHeight: 36,
    maxWidth: "100%" as const,
  },
  grip: {
    paddingLeft: spacing.m,
    paddingRight: spacing.xs,
    gap: 2,
  },
  gripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.inkFaint,
  },
  trayChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.ink,
    paddingRight: spacing.l,
    paddingVertical: spacing.s,
  },

  // week canvas
  weekCanvasWrap: {
    marginHorizontal: spacing.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.l,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  weekCanvas: {
    flexDirection: "row",
    minWidth: "100%" as const,
  },
  weekCol: {
    width: 160,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.hairline,
  },
  weekColSelected: {
    backgroundColor: colors.accentSoft,
  },
  weekHead: {
    alignItems: "center",
    paddingVertical: spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  weekDayName: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  weekDayNum: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
    marginTop: 2,
  },
  weekDayNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  weekBody: {
    padding: spacing.s,
    gap: spacing.s,
    minHeight: 120,
  },
  weekChip: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.s,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
  weekChipTime: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fonts.body,
    color: colors.accent,
    fontVariant: ["tabular-nums"],
  },
  weekChipName: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  weekFree: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    textAlign: "center",
    marginTop: spacing.l,
  },

  // month grid
  monthGrid: {
    marginHorizontal: spacing.l,
  },
  monthHead: {
    flexDirection: "row",
    marginBottom: spacing.xs,
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
  monthCells: {
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
    marginHorizontal: spacing.l,
  },
  empty: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
