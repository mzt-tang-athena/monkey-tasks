import * as React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskItem } from "../../features/tasks/query";
import type { CaptureTarget } from "../../features/capture/write";
import { addDays, dayLabel, formatLocal, formatTime24, parseStoredDate, startOfDay } from "../../lib/dates";
import { CaptureSheet } from "../../components/CaptureSheet";
import { BottomNavbar } from "../../components/BottomNavbar";
import { t } from "../../theme/tokens";
import { useMockTasks } from "../../lib/mock";

/**
 * Planner tab, design variant C. Day mode is the landing: an
 * all-day card up top, then an hour-ruler timeline with tasks
 * pinned between hour marks. Week and month stay compact and data
 * driven. Mock driven, see lib/mock.
 */

type Mode = "day" | "week" | "month";

const MODES: { key: Mode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** First and last hour shown by the ruler. */
const RULER_START = 7;
const RULER_END = 22;

export default function PlannerScreen() {
  const { tasks, loading, error, toggle, capture } = useMockTasks();
  const [mode, setMode] = React.useState<Mode>("day");
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const selected = startOfDay(selectedDate);
  const today = startOfDay(new Date());
  const isToday = selected.getTime() === today.getTime();

  const open = tasks.filter((item) => !(item.data?.completed != null && item.data.completed !== ""));

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

  const stripDays = [-3, -2, -1, 0, 1, 2, 3].map((offset) => addDays(selected, offset));

  const dayTasks = open.filter((item) => dayOf(item) === selected.getTime());
  const allDay = dayTasks.filter((item) => !hasTime(item));
  const scheduled = dayTasks
    .filter(hasTime)
    .sort((a, b) => (timeOf(a) ?? 0) - (timeOf(b) ?? 0));
  const overdue = open
    .filter((item) => dayOf(item) < selected.getTime())
    .sort((a, b) => (timeOf(a) ?? dayOf(a)) - (timeOf(b) ?? dayOf(b)));

  const dayContent = (
    <React.Fragment>
      {allDay.length > 0 || overdue.length > 0 ? (
        <View style={styles.group}>
          {allDay.length > 0 ? (
            <View style={styles.card}>
              {allDay.map((task, index) => (
                <TaskLine
                  key={task.uri}
                  task={task}
                  onToggle={toggle}
                  divider={index < allDay.length - 1}
                />
              ))}
            </View>
          ) : null}
          {overdue.length > 0 ? (
            <React.Fragment>
              {allDay.length > 0 ? <View style={styles.gap} /> : null}
              <Text style={styles.rulerLabelDanger}>Overdue</Text>
              <View style={[styles.card, styles.cardDanger]}>
                {overdue.map((task, index) => (
                  <TaskLine
                    key={task.uri}
                    task={task}
                    onToggle={toggle}
                    divider={index < overdue.length - 1}
                    danger
                  />
                ))}
              </View>
            </React.Fragment>
          ) : null}
        </View>
      ) : null}

      {scheduled.length > 0 || overdue.length > 0 ? <Timeline tasks={scheduled} isToday={isToday} onToggle={toggle} /> : null}
      {allDay.length === 0 && scheduled.length === 0 && overdue.length === 0 && !loading && !error
        ? <Text style={styles.empty}>Nothing scheduled. Enjoy the calm.</Text>
        : null}
    </React.Fragment>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={[{ key: "content" }]}
        renderItem={() => (
          <View>
            {error ? (
              <View style={styles.card}>
                <Text style={[styles.statusText, styles.statusTextDanger]}>{error}</Text>
              </View>
            ) : null}
            {loading ? <LoadingSkeleton /> : null}
            {!loading && !error
              ? (
                <View>
                  <View style={styles.segmentTrack}>
                    {MODES.map((entry) => (
                      <Pressable
                        key={entry.key}
                        onPress={() => setMode(entry.key)}
                        accessibilityLabel={entry.label}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === entry.key }}
                        style={({ pressed }) => [
                          styles.segment,
                          mode === entry.key && styles.segmentActive,
                          pressed && mode !== entry.key && styles.segmentPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            mode === entry.key && styles.segmentLabelActive,
                          ]}
                        >
                          {entry.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {mode === "day" ? (
                    <React.Fragment>
                      <View style={styles.strip}>
                        {stripDays.map((date) => (
                          <DayCell
                            key={stripKey(date)}
                            date={date}
                            selected={startOfDay(date).getTime() === selected.getTime()}
                            isToday={startOfDay(date).getTime() === today.getTime()}
                            hasTasks={countOn(open, date) > 0}
                            onPress={() => setSelectedDate(date)}
                          />
                        ))}

                      </View>
                      <Text style={styles.dayTitle}>{dayLabel(selected, today)}</Text>
                      {dayContent}
                    </React.Fragment>
                  ) : null}

                  {mode === "week" ? (
                    <View>
                      {stripDays.map((date) => (
                        <WeekDayCard
                          key={stripKey(date)}
                          date={date}
                          selected={startOfDay(date).getTime() === selected.getTime()}
                          items={onDate(open, date)}
                          todayLabel={dayLabel(date, today)}
                          onPress={() => {
                            setSelectedDate(date);
                            setMode("day");
                          }}
                        />
                      ))}
                    </View>
                  ) : null}

                  {mode === "month" ? (
                    <MonthGrid
                      monthDate={selected}
                      today={today}
                      tasks={open}
                      onPick={(date) => {
                        setSelectedDate(date);
                        setMode("day");
                      }}
                    />
                  ) : null}
                </View>
              )
              : null}
          </View>
        )}
      />
      <BottomNavbar active="planner" onCapture={() => setSheetOpen(true)} />
      {sheetOpen ? (
        <CaptureSheet
          visible
          targets={targets}
          defaultTargetIndex={0}
          preselectedDue={formatLocal(selected, false)}
          onClose={() => setSheetOpen(false)}
          onSend={send}
        />
      ) : null}
    </View>
  );
}

/** The hour ruler: mono hour marks and task cards pinned between. */
function Timeline({
  tasks,
  isToday,
  onToggle,
}: {
  tasks: TaskItem[];
  isToday: boolean;
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

  return (
    <View style={styles.ruler}>
      {hours.map((slotTasks, hour) => {
        const children: React.ReactNode[] = [];
        let placedNow = false;
        for (const task of slotTasks) {
          if (isToday && hour === now.getHours() && (timeOf(task) ?? 0) > now.getMinutes() && !placedNow) {
            children.push(<NowLine key={"now"} />);
            placedNow = true;
          }
          children.push(
            <HourTask key={task.uri} task={task} onToggle={onToggle} />,
          );
        }
        if (isToday && hour === now.getHours() && !placedNow) {
          children.push(<NowLine key={"now"} />);
        }
        return (
          <View key={hour}>
            <View style={styles.rulerHead}>
              <Text style={styles.rulerMark}>{labelHour(hour)}</Text>
            </View>
            {children.length > 0 ? (
              <View style={styles.rulerSlot}>{children}</View>
            ) : null}
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
  const due = task.data?.due ? parseStoredDate(task.data.due) : null;
  return (
    <Pressable
      onPress={() => onToggle(task)}
      accessibilityLabel="mark done"
      accessibilityRole="button"
      style={({ pressed }) => [styles.hourTask, pressed && styles.hourTaskPressed]}
    >
      <View style={styles.taskBar} />
      <Text style={styles.taskName} numberOfLines={2}>
        {task.name}
      </Text>
      {due?.hasTime ? <Text style={styles.taskTime}>{formatTime24(due.date)}</Text> : null}
    </Pressable>
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

function TaskLine({
  task,
  onToggle,
  divider,
  danger = false,
}: {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
  divider: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onToggle(task)}
      accessibilityLabel="mark done"
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.taskLine,
        divider && styles.taskLineDivider,
        pressed && styles.taskLinePressed,
      ]}
    >
      <View style={[styles.taskBarPill, danger && styles.taskBarDanger]} />
      <Text style={[styles.taskName, danger && styles.taskNameDanger, { flex: 1 }]} numberOfLines={2}>
        {task.name}
      </Text>
      {hasTime(task) ? (
        <Text style={styles.taskTime}>
          {formatTime24(parseStoredDate(task.data?.due ?? "")?.date ?? new Date())}
        </Text>
      ) : null}
    </Pressable>
  );
}

function DayCell({
  date,
  selected,
  isToday,
  hasTasks,
  onPress,
}: {
  date: Date;
  selected: boolean;
  isToday: boolean;
  hasTasks: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={`${WEEKDAY_LETTERS[date.getDay()]} ${date.getDate()}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.cell,
        selected && styles.cellSelected,
        pressed && !selected && styles.cellPressed,
      ]}
    >
      <Text style={styles.cellWeekday}>{WEEKDAY_LETTERS[date.getDay()]}</Text>
      <Text style={[styles.cellDay, isToday && !selected && styles.cellDayToday, isToday && selected && styles.cellDayToday]}>
        {date.getDate()}
      </Text>
      {hasTasks ? <View style={[styles.cellDot, selected && styles.cellDotActive]} /> : <View style={styles.cellDotGap} />}
    </Pressable>
  );
}

function WeekDayCard({
  date,
  selected,
  items,
  todayLabel,
  onPress,
}: {
  date: Date;
  selected: boolean;
  items: TaskItem[];
  todayLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, styles.weekCard, selected && styles.weekCardSelected, pressed && styles.cardPressed]}
    >
      <View style={styles.weekHead}>
        <Text style={styles.weekday}>{WEEKDAY_LETTERS[date.getDay()]}</Text>
        <Text style={styles.weekDayNumber}>{date.getDate()}</Text>
        <Text style={styles.weekLabel}>{todayLabel}</Text>
      </View>
      <View style={styles.weekItems}>
        {items.slice(0, 3).map((task) => (
          <Text key={task.uri} style={styles.weekItemName} numberOfLines={1}>
            {task.name}
          </Text>
        ))}
        {items.length === 0 ? <Text style={styles.weekEmpty}>-</Text> : null}
      </View>
    </Pressable>
  );
}

function MonthGrid({
  monthDate,
  today,
  tasks,
  onPick,
}: {
  monthDate: Date;
  today: Date;
  tasks: TaskItem[];
  onPick: (date: Date) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }

  return (
    <View>
      <View style={styles.monthHead}>
        {WEEKDAY_LETTERS.map((letter, index) => (
          <Text key={index} style={styles.monthHeadLabel}>
            {letter}
          </Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {cells.map((date, index) =>
          date ? (
            <Pressable
              key={index}
              onPress={() => onPick(date)}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_LETTERS[date.getDay()]} ${date.getDate()} ${date.getMonth() + 1}`}
              style={({ pressed }) => [styles.monthCell, pressed && styles.monthCellPressed]}
            >
              <View
                style={[
                  styles.monthDayRing,
                  startOfDay(date).getTime() === today.getTime() && styles.monthDayToday,
                ]}
              >
                <Text
                  style={[
                    styles.monthDay,
                    startOfDay(date).getTime() === today.getTime() && styles.monthDayTodayText,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
              {countOn(tasks, date) > 0 ? <View style={styles.monthDot} /> : null}
            </Pressable>
          ) : (
            <View key={index} style={styles.monthCell} />
          ),
        )}
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <View style={[styles.bar, styles.barWide]} />
      <View style={[styles.bar, styles.barMid]} />
      <View style={[styles.bar, styles.barNarrow]} />
    </View>
  );
}

/* Helpers over the mock vault. */

function dayOf(item: TaskItem): number {
  const due = item.data?.due ? parseStoredDate(item.data.due) : null;
  return due ? startOfDay(due.date).getTime() : Infinity;
}

function hasTime(item: TaskItem): boolean {
  return Boolean(item.data?.due && parseStoredDate(item.data.due)?.hasTime);
}

/** Minutes since midnight, or null when the task has no time. */
function timeOf(item: TaskItem): number | null {
  const due = item.data?.due ? parseStoredDate(item.data.due) : null;
  if (!due || !due.hasTime) {
    return null;
  }
  return due.date.getHours() * 60 + due.date.getMinutes();
}

function hourOf(item: TaskItem): number | null {
  const minutes = timeOf(item);
  return minutes === null ? null : Math.floor(minutes / 60);
}

function countOn(items: TaskItem[], date: Date): number {
  const day = startOfDay(date).getTime();
  return items.filter((item) => dayOf(item) === day).length;
}

function onDate(items: TaskItem[], date: Date): TaskItem[] {
  const day = startOfDay(date).getTime();
  return items
    .filter((item) => dayOf(item) === day)
    .sort((a, b) => (timeOf(a) ?? 0) - (timeOf(b) ?? 0));
}

function stripKey(date: Date): string {
  return formatLocal(date, false);
}

function labelHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
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
    gap: t.spacing.lg,
  },
  segmentTrack: {
    flexDirection: "row",
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.pill,
    padding: t.spacing.xs,
    gap: t.spacing.xxs,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.pill,
  },
  segmentActive: {
    backgroundColor: t.colors.surfaceActive,
  },
  segmentPressed: {
    opacity: 0.7,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
  },
  segmentLabelActive: {
    color: t.colors.text,
  },
  strip: {
    flexDirection: "row",
    gap: t.spacing.xs,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.md,
    gap: t.spacing.xs,
  },
  cellSelected: {
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  cellPressed: {
    opacity: 0.7,
  },
  cellWeekday: {
    fontSize: 11,
    letterSpacing: 1,
    color: t.colors.textFaint,
    fontFamily: t.fonts.sans,
  },
  cellDay: {
    fontSize: 16,
    fontWeight: "600",
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
  },
  cellDayToday: {
    color: t.colors.accent,
  },
  cellDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.accentDeep,
  },
  cellDotActive: {
    backgroundColor: t.colors.accent,
  },
  cellDotGap: {
    height: 4,
  },
  dayTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: t.colors.text,
    fontFamily: t.fonts.sans,
  },
  group: {
    gap: t.spacing.sm,
  },
  gap: {
    height: t.spacing.lg,
  },
  card: {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardDanger: {
    borderColor: t.colors.danger,
  },
  taskLine: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
  },
  taskLineDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  taskLinePressed: {
    backgroundColor: t.colors.surfaceActive,
  },
  taskBarPill: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: t.colors.accentDeep,
    marginRight: t.spacing.md,
  },
  taskBarDanger: {
    backgroundColor: t.colors.danger,
  },
  taskName: {
    fontSize: 15,
    lineHeight: 20,
    color: t.colors.text,
    fontFamily: t.fonts.sans,
  },
  taskNameDanger: {
    color: t.colors.textMuted,
  },
  taskTime: {
    fontSize: 12,
    color: t.colors.textMuted,
    fontFamily: t.fonts.mono,
    marginLeft: t.spacing.sm,
  },
  ruler: {
    gap: t.spacing.xs,
  },
  rulerHead: {
    height: 20,
    justifyContent: "flex-end",
    paddingBottom: t.spacing.xxs,
  },
  rulerMark: {
    fontSize: 11,
    color: t.colors.textFaint,
    fontFamily: t.fonts.mono,
  },
  rulerLabelDanger: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    color: t.colors.danger,
    fontFamily: t.fonts.sans,
    marginBottom: t.spacing.sm,
  },
  rulerSlot: {
    gap: t.spacing.xs,
    marginBottom: t.spacing.sm,
  },
  hourTask: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
  },
  hourTaskPressed: {
    backgroundColor: t.colors.surfaceActive,
  },
  taskBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: t.colors.accentDeep,
    marginRight: t.spacing.md,
  },
  nowLineRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 2,
    marginVertical: t.spacing.xs,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.accent,
    marginLeft: -t.spacing.xs,
  },
  nowLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: t.colors.accent,
  },
  empty: {
    color: t.colors.textMuted,
    fontSize: 15,
    fontFamily: t.fonts.sans,
    marginTop: t.spacing.xl,
  },
  weekCard: {
    padding: t.spacing.md,
    marginBottom: t.spacing.sm,
  },
  weekCardSelected: {
    borderColor: t.colors.borderStrong,
  },
  weekHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: t.spacing.md,
    marginBottom: t.spacing.sm,
  },
  weekday: {
    fontSize: 13,
    fontWeight: "700",
    color: t.colors.textFaint,
    fontFamily: t.fonts.sans,
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: t.colors.text,
    fontFamily: t.fonts.sans,
  },
  weekLabel: {
    fontSize: 14,
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
  },
  weekItems: {
    gap: t.spacing.xxs,
  },
  weekItemName: {
    fontSize: 14,
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
  },
  weekEmpty: {
    fontSize: 14,
    color: t.colors.textFaint,
    fontFamily: t.fonts.sans,
  },
  monthHead: {
    flexDirection: "row",
    marginBottom: t.spacing.sm,
  },
  monthHeadLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 1,
    color: t.colors.textFaint,
    fontFamily: t.fonts.sans,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthCell: {
    width: `${100 / 7}%`,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  monthCellPressed: {
    backgroundColor: t.colors.surfaceActive,
    borderRadius: t.radii.sm,
  },
  monthDayRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  monthDayToday: {
    backgroundColor: t.colors.accent,
  },
  monthDay: {
    fontSize: 14,
    color: t.colors.textMuted,
    fontFamily: t.fonts.sans,
  },
  monthDayTodayText: {
    color: t.colors.onAccent,
    fontWeight: "700",
  },
  monthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.accentDeep,
    position: "absolute",
    bottom: 2,
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
  skeletonCard: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
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
