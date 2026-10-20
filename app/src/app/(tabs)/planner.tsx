import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { groupByDue, type TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { TaskRow } from "../../components/TaskRow";
import { CaptureSheet } from "../../components/CaptureSheet";
import { BottomBar } from "../../components/BottomBar";
import { loadMockTasks, toggleMockCompleted } from "../../lib/mock";
import { addDays, parseStoredDate, startOfDay } from "../../lib/dates";
import { colors, fonts, spacing, radii, measure } from "../../theme/tokens";

/**
 * The consolidated Planner tab. Day mode is the hero: a compact
 * header (toggle pills, short serif date, accent rule), then D's body
 * - the hour-ruler timeline with tasks pinned at their times, the
 * live now line, and the unscheduled tray docked at the foot. Week is
 * F's horizontal canvas of day columns; month stays a card with dots
 * and lists a day's tasks on tap.
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

const TARGETS: CaptureTarget[] = [
  { kind: "list", name: "Focus", uri: "mock://vault/Tasks/Lists/Focus.md" },
  { kind: "main" },
];

/** First and last hour shown by the ruler. */
const RULER_START = 7;
const RULER_END = 22;

export default function PlannerScreen() {
  const [tasks, setTasks] = React.useState<TaskItem[] | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mode, setMode] = React.useState<Mode>("day");
  const [selected, setSelected] = React.useState(() => startOfDay(new Date()));
  const [draft, setDraft] = React.useState<{
    text: string;
    targetIndex: number;
  } | null>(null);

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
        {/* E's economy: the toggle pills lead the header block. */}
        <View style={styles.segmented}>
          {(["day", "week", "month"] as Mode[]).map((option) => (
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
          <WeekView
            tasks={open}
            today={new Date()}
            selected={selected}
            onSelect={setSelected}
          />
        ) : null}
        {status === "ready" && mode === "month" ? (
          <MonthView
            tasks={open}
            today={new Date()}
            onToggle={toggle}
            onOpenDay={(day) => {
              setSelected(day);
              setMode("day");
            }}
          />
        ) : null}
      </ScrollView>

      {/* One bottom bar: nav left, capture field right. */}
      <BottomBar
        targets={TARGETS}
        defaultTargetIndex={1}
        onSend={() => undefined}
        onOpenDetails={(text, targetIndex) =>
          setDraft(text.trim() ? { text, targetIndex } : null)
        }
      />
      {draft ? (
        <CaptureSheet
          visible
          targets={TARGETS}
          defaultTargetIndex={draft.targetIndex}
          initialText={draft.text}
          preselectedDue={isoOf(selected)}
          onClose={() => setDraft(null)}
          onSend={() => setDraft(null)}
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
  const dayTasks = sameDay ? groups.today : tasksForDay(tasks, date);
  const timed = dayTasks.filter(hasTime);
  const untimed = dayTasks.filter((task) => !hasTime(task));
  // Undated open tasks wait in the tray on every day spread.
  const tray = groups.undated;

  return (
    <View>
      {/* Compact day heading: eyebrow, short serif date, accent rule. */}
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

      {/* Untimed tasks for the day, before the ruler. */}
      {untimed.length > 0 ? (
        <View style={styles.anytimeBlock}>
          <Text style={styles.sectionLabel}>Anytime  {untimed.length}</Text>
          {untimed.map((task, index) => (
            <View
              key={task.uri}
              style={index > 0 ? styles.groupRow : undefined}
            >
              <TaskRow task={task} onToggle={onToggle} />
            </View>
          ))}
        </View>
      ) : null}

      {/* The hour ruler, with drop targets when the tray has tasks. */}
      <Text style={styles.sectionLabel}>Timeline</Text>
      <Timeline
        tasks={timed}
        isToday={sameDay}
        showDropTargets={tray.length > 0}
        onToggle={onToggle}
      />

      {/* Undated tasks, docked at the foot of the spread. */}
      <UnscheduledTray tasks={tray} />
    </View>
  );
}

/** The hour ruler: hour marks down the left, tasks pinned between. */
function Timeline({
  tasks,
  isToday,
  showDropTargets,
  onToggle,
}: {
  tasks: TaskItem[];
  isToday: boolean;
  showDropTargets: boolean;
  onToggle: (task: TaskItem) => void;
}) {
  const now = new Date();
  const hours: TaskItem[][] = [];
  for (let h = RULER_START; h <= RULER_END; h++) {
    hours[h] = [];
  }
  for (const task of tasks) {
    const hour = hourOf(task);
    if (hour === null) {
      continue;
    }
    const slot = Math.min(Math.max(hour, RULER_START), RULER_END);
    hours[slot].push(task);
  }

  // One convincing drop target: the next free hour on today's ruler.
  const ghostHour = showDropTargets ? nextFreeHour(hours, isToday, now) : null;

  return (
    <View style={styles.ruler}>
      {hours.map((slotTasks, hour) => {
        const children: React.ReactNode[] = [];
        let placedNow = false;
        for (const task of slotTasks) {
          if (
            isToday &&
            hour === now.getHours() &&
            minuteOf(task) > now.getMinutes() &&
            !placedNow
          ) {
            children.push(<NowLine key="now" />);
            placedNow = true;
          }
          children.push(
            <HourTask key={task.uri} task={task} onToggle={onToggle} />,
          );
        }
        if (isToday && hour === now.getHours() && !placedNow) {
          children.push(<NowLine key="now" />);
        }
        if (hour === ghostHour) {
          children.push(<DropSlot key="drop" />);
        }
        return (
          <View
            key={hour}
            style={[styles.rulerRow, showDropTargets ? styles.rulerRowDrop : null]}
          >
            <Text style={styles.rulerMark}>{labelHour(hour)}</Text>
            <View style={styles.rulerSlot}>{children}</View>
          </View>
        );
      })}
    </View>
  );
}

function HourTask({
  task,
  onToggle,
}: {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
}) {
  const [pressed, setPressed] = React.useState(false);
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return (
    <Pressable
      onPress={() => onToggle(task)}
      disabled={onToggle == null}
      onHoverIn={() => setPressed(true)}
      onHoverOut={() => setPressed(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={onToggle != null ? "mark done" : undefined}
      accessibilityRole="button"
      style={[styles.hourTask, pressed && styles.hourTaskPressed]}
    >
      <View style={styles.taskBar} />
      <View style={styles.taskBody}>
        <Text style={styles.taskName} numberOfLines={2}>
          {task.name}
        </Text>
        {due?.hasTime ? (
          <Text style={styles.taskTime}>{formatTime(due.date)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A dashed drop slot on the ruler, where a tray task would land. */
function DropSlot() {
  return (
    <View style={styles.dropSlot}>
      <View style={styles.dropSlotNotch} />
      <Text style={styles.dropSlotText}>drop here</Text>
    </View>
  );
}

function NowLine() {
  return (
    <View style={styles.nowLineRow}>
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
    </View>
  );
}

/** The unscheduled tray: undated tasks docked at the spread's foot. */
function UnscheduledTray({ tasks }: { tasks: TaskItem[] }) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <View style={styles.tray}>
      <View style={styles.trayEdge} />
      <View style={styles.trayHead}>
        <Text style={styles.trayLabel}>Unscheduled  {tasks.length}</Text>
        <Text style={styles.trayHint}>drag onto the timeline</Text>
      </View>
      <View style={styles.trayChips}>
        {tasks.map((task) => (
          <View key={task.uri} style={styles.trayChip}>
            <View style={styles.trayGrip}>
              <View style={styles.trayGripDot} />
              <View style={styles.trayGripDot} />
            </View>
            <Text style={styles.trayChipText} numberOfLines={1}>
              {task.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- week */

/** F's week body: day columns with real content, one swipe away. */
function WeekView({
  tasks,
  today,
  selected,
  onSelect,
}: {
  tasks: TaskItem[];
  today: Date;
  selected: Date;
  onSelect: (date: Date) => void;
}) {
  const todayStart = startOfDay(today).getTime();
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.weekCanvas}
    >
      {days.map((day) => {
        const items = tasksForDay(tasks, day);
        const isToday = startOfDay(day).getTime() === todayStart;
        const isSelected =
          startOfDay(day).getTime() === startOfDay(selected).getTime();
        return (
          <Pressable
            key={day.getTime()}
            style={({ pressed }) => [
              styles.weekCol,
              isSelected && !isToday && styles.weekColSelected,
              isToday && styles.weekColToday,
              pressed && styles.pressedFill,
            ]}
            onPress={() => onSelect(day)}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
          >
            <Text style={styles.weekDayName}>
              {isToday ? "Today" : WEEKDAYS[day.getDay()]}
            </Text>
            <Text
              style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}
            >
              {day.getDate()}
            </Text>
            <View style={styles.weekColRule} />
            {items.length > 0 ? (
              items.map((task) => (
                <View key={task.uri} style={styles.weekTask}>
                  <View style={styles.taskBar} />
                  <Text style={styles.weekTaskText} numberOfLines={3}>
                    {hasTime(task) ? `${timeOf(task)}  ` : ""}
                    {task.name}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.weekFree}>free</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* -------------------------------------------------------------- month */

/** D/F month: the grid in a card; a tapped day lists its tasks. */
function MonthView({
  tasks,
  today,
  onToggle,
  onOpenDay,
}: {
  tasks: TaskItem[];
  today: Date;
  onToggle: (task: TaskItem) => void;
  onOpenDay: (day: Date) => void;
}) {
  const [picked, setPicked] = React.useState<Date | null>(null);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const lead = monthStart.getDay();
  const byDay = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    if (task.data?.due == null) {
      continue;
    }
    const iso = task.data.due.slice(0, 10);
    const bucket = byDay.get(iso);
    if (bucket) {
      bucket.push(task);
    } else {
      byDay.set(iso, [task]);
    }
  }
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(today.getFullYear(), today.getMonth(), index + 1),
    ),
  ];
  const pickedTasks = picked ? (byDay.get(isoOf(picked)) ?? []) : null;

  return (
    <View>
      <Text style={styles.monthTitle}>
        {MONTHS[today.getMonth()]} {today.getFullYear()}
      </Text>
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
              <Pressable
                key={day.getTime()}
                style={({ pressed }) => [
                  styles.monthCell,
                  isSameDay(day, picked) && styles.monthCellPicked,
                  isSameDay(day, today) && styles.monthCellToday,
                  pressed && styles.pressedFill,
                ]}
                onPress={() => setPicked(day)}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
              >
                <Text
                  style={[
                    styles.monthNum,
                    isSameDay(day, today) && styles.monthNumToday,
                  ]}
                >
                  {day.getDate()}
                </Text>
                {byDay.has(isoOf(day)) ? <View style={styles.monthDot} /> : null}
              </Pressable>
            ),
          )}
        </View>
      </View>

      {/* The tapped day's tasks, listed beneath the card. */}
      {pickedTasks ? (
        <View style={styles.monthDayPanel}>
          <Text style={styles.sectionLabel}>
            {WEEKDAYS_FULL[picked!.getDay()]} {picked!.getDate()}
            {"  "}
            {pickedTasks.length}
          </Text>
          {pickedTasks.length > 0 ? (
            pickedTasks.map((task, index) => (
              <View
                key={task.uri}
                style={index > 0 ? styles.groupRow : undefined}
              >
                <TaskRow task={task} onToggle={onToggle} />
              </View>
            ))
          ) : (
            <Text style={styles.monthDayEmpty}>Nothing scheduled.</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.monthDayOpen,
              pressed && styles.detailsPressed,
            ]}
            onPress={() => onOpenDay(picked!)}
            accessibilityRole="button"
            accessibilityLabel="open this day"
          >
            <Text style={styles.monthDayOpenText}>Open in day view</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------- helpers */

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
  return task.data?.due
    ? (parseStoredDate(task.data.due)?.hasTime ?? false)
    : false;
}

function timeOf(task: TaskItem): string {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  if (!due) {
    return "";
  }
  return formatTime(due.date);
}

function hourOf(task: TaskItem): number | null {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return due?.hasTime ? due.date.getHours() : null;
}

function minuteOf(task: TaskItem): number {
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return due?.date.getMinutes() ?? 0;
}

/** The first hour from now with no tasks, for the drop-slot ghost. */
function nextFreeHour(
  hours: TaskItem[][],
  isToday: boolean,
  now: Date,
): number | null {
  const from = isToday ? now.getHours() : RULER_START;
  for (let h = Math.max(from, RULER_START); h <= RULER_END; h++) {
    if ((hours[h] ?? []).length === 0) {
      return h;
    }
  }
  return null;
}

function labelHour(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${String(date.getMinutes()).padStart(2, "0")} ${ampm}`;
}

function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (a == null || b == null) {
    return false;
  }
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
    maxWidth: measure,
    alignSelf: "center" as const,
    width: "100%" as const,
    paddingHorizontal: 26,
    paddingTop: spacing.m,
    paddingBottom: spacing.xl,
  },
  pressedFill: {
    backgroundColor: colors.pressed,
  },

  // segmented toggle, E's tighter spacing
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 3,
    marginBottom: spacing.m,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.s,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontSize: 12,
    lineHeight: 15,
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

  // compact day heading
  dateMonth: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  dateHeader: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  dateRule: {
    height: 2,
    backgroundColor: colors.accent,
    width: 40,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
    borderRadius: 1,
  },
  overdueBlock: {
    marginBottom: spacing.l,
  },
  overdueLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  anytimeBlock: {
    marginBottom: spacing.l,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: spacing.s,
  },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },

  // hour ruler
  ruler: {
    marginBottom: spacing.l,
  },
  rulerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rulerRowDrop: {
    borderBottomColor: colors.accentSoft,
    borderBottomWidth: 2,
  },
  rulerMark: {
    width: 56,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
    paddingTop: spacing.xs,
  },
  rulerSlot: {
    flex: 1,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  hourTask: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.s,
    gap: spacing.s,
  },
  hourTaskPressed: {
    backgroundColor: colors.pressed,
  },
  taskBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
    minHeight: 20,
  },
  taskBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  taskName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  taskTime: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
  },
  dropSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    borderRadius: radii.m,
    borderStyle: "dashed",
    padding: spacing.s,
    minHeight: 36,
  },
  dropSlotNotch: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
  },
  dropSlotText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    fontStyle: "italic",
  },
  nowLineRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 18,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    marginRight: spacing.xs,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.danger,
    borderRadius: 1,
  },

  // unscheduled tray, docked at the foot of the spread
  tray: {
    backgroundColor: colors.pressed,
    borderRadius: radii.l,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  trayEdge: {
    alignSelf: "stretch" as const,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.inkFaint,
    marginBottom: spacing.m,
  },
  trayHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.s,
  },
  trayLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.accent,
  },
  trayHint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    fontStyle: "italic",
  },
  trayChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s,
  },
  trayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    paddingLeft: spacing.s,
    paddingRight: spacing.m,
    paddingVertical: spacing.s,
    maxWidth: "100%" as const,
  },
  trayGrip: {
    alignItems: "center",
    gap: 2,
  },
  trayGripDot: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.inkFaint,
  },
  trayChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.ink,
  },

  // week canvas: horizontally scrolling day columns
  weekCanvas: {
    flexDirection: "row",
    gap: spacing.s,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xl,
  },
  weekCol: {
    width: 176,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.m,
    padding: spacing.s,
    minHeight: 240,
  },
  weekColSelected: {
    borderColor: colors.accent,
  },
  weekColToday: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  weekDayName: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekDayNum: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  weekDayNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  weekColRule: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.s,
  },
  weekTask: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.paper,
    borderRadius: radii.s,
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  weekTaskText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  weekFree: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    textAlign: "center",
  },

  // month view
  monthTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: spacing.s,
  },
  monthCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.m,
    marginBottom: spacing.m,
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
    borderRadius: radii.m,
  },
  monthCellPicked: {
    backgroundColor: colors.accentSoft,
  },
  monthCellToday: {
    backgroundColor: colors.accentSoft,
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
  monthDayPanel: {
    marginBottom: spacing.xl,
  },
  monthDayEmpty: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    paddingVertical: spacing.m,
  },
  monthDayOpen: {
    alignSelf: "flex-start" as const,
    marginTop: spacing.s,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.m,
    borderRadius: radii.m,
  },
  monthDayOpenText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  detailsPressed: {
    backgroundColor: colors.pressed,
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
