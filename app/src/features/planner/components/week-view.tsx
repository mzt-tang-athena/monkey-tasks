import * as React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { TaskItem } from "@/types/task";
import type { WeekLayout, WeekStart } from "@/lib/settings";
import { Pressable } from "@/components/ui/pressable";
import { PlanDrag, type PlanTarget } from "@/features/planner/lib/plan-drag";
import { hasTime, timeOf } from "@/features/planner/model";
import { WEEKDAYS, WEEKDAYS_FULL } from "@/features/planner/lib/labels";
import {
  rowsLine,
  spreadBox,
  weekCells,
  weekChipCount,
  weekDays,
  weekLayouts,
  weekRows,
  type WeekDay,
  type WeekSlot,
} from "@/features/planner/lib/week-body";
import { fonts, radius, spacing, touchTarget, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

/** What a day box gets from the body around it. */
type DayProps = {
  day: WeekDay;
  /** The first grid cell the box owns: its drop ring's cell. */
  cell: number;
  /** How many grid columns the box spans. */
  span: number;
  /** False for the pager's neighbour page: it draws, it takes no press
      and no drop. */
  interactive: boolean;
  onSelect?: (date: Date) => void;
  onOpenDay?: (date: Date) => void;
};

/** Each layout's grid rows and its day box. The rest of the body is
    the same for both. */
const faces: Record<
  WeekLayout,
  { slots: WeekSlot[][]; Day: (props: DayProps) => React.ReactNode }
> = {
  spread: { slots: weekRows(weekLayouts.spread), Day: SpreadDay },
  rows: { slots: weekRows(weekLayouts.rows), Day: RowsDay },
};

/**
 * The week body: seven day boxes on one screen, in the layout the
 * operator picked in Settings. The live page is one drop grid, and
 * each box rings itself while a drag hovers it. The pager's neighbour
 * page draws the same boxes with `interactive={false}`.
 */
export function WeekView({
  layout,
  tasks,
  today,
  selected,
  weekStart,
  interactive,
  onSelect,
  onOpenDay,
}: {
  layout: WeekLayout;
  tasks: TaskItem[];
  today: Date;
  selected: Date;
  /** The day the week starts on: the boxes run in its order. */
  weekStart: WeekStart;
  interactive: boolean;
  onSelect?: (date: Date) => void;
  /** The "+N" count opens that day in the day view. */
  onOpenDay?: (date: Date) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const days = React.useMemo(
    () => weekDays({ tasks, selected, today, weekStart }),
    [tasks, selected, today, weekStart],
  );
  const geometry = weekLayouts[layout];
  // One target object per day: Saturday's two Spread cells share it.
  const cells = React.useMemo(() => {
    const targets = days.map((day): PlanTarget => ({ kind: "day", iso: day.iso }));
    return weekCells(geometry, targets);
  }, [days, geometry]);
  const { slots, Day } = faces[layout];

  const grid = slots.map((row) => (
    <View key={row[0].cell} style={styles.row}>
      {row.map((slot) => (
        <Day
          key={slot.day}
          day={days[slot.day]}
          cell={slot.cell}
          span={slot.span}
          interactive={interactive}
          onSelect={onSelect}
          onOpenDay={onOpenDay}
        />
      ))}
    </View>
  ));
  // The grid never goes under its layout's height, and takes any
  // spare room a hidden task list leaves.
  const body: StyleProp<ViewStyle> = [
    styles.grid,
    layout === "spread" && styles.spreadGrid,
    { minHeight: geometry.height },
  ];

  return (
    <View
      testID={interactive ? `week-view:${layout}` : undefined}
      aria-hidden={!interactive}
      style={[styles.root, layout === "rows" && styles.card]}
    >
      {interactive ? (
        <PlanDrag.Grid
          columns={geometry.columns}
          rows={geometry.rows}
          cells={cells}
          mark="ring"
          style={body}
        >
          {grid}
        </PlanDrag.Grid>
      ) : (
        <View style={body}>{grid}</View>
      )}
    </View>
  );
}

/**
 * A day box. The box draws, the day press fills it, and the "+N" press
 * and the ring sit over it as siblings. A button may not nest inside
 * another button, and the count opens the day instead of selecting it.
 */
function DayBox({
  day,
  interactive,
  onSelect,
  style,
  content,
  more,
  ring,
  children,
}: {
  day: WeekDay;
  interactive: boolean;
  onSelect?: (date: Date) => void;
  style: StyleProp<ViewStyle>;
  /** The press's own layout, over the box's fill. */
  content: StyleProp<ViewStyle>;
  more?: React.ReactNode;
  ring?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={style}>
      {interactive ? (
        <Pressable
          testID={`week-day:${day.iso}`}
          style={({ pressed }) => [styles.fill, content, pressed && styles.pressed]}
          onPress={() => onSelect?.(day.date)}
          accessibilityRole="button"
        >
          {children}
        </Pressable>
      ) : (
        <View style={[styles.fill, content]}>{children}</View>
      )}
      {more}
      {ring}
    </View>
  );
}

/** One task, one line. A live chip lifts into a drag after its hold. */
function Chip({
  task,
  interactive,
  style,
}: {
  task: TaskItem;
  interactive: boolean;
  style: StyleProp<ViewStyle>;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const face = (
    <>
      <View style={styles.bar} />
      <Text style={styles.chipText} numberOfLines={1}>
        {hasTime(task) ? `${timeOf(task)}  ` : ""}
        {task.name}
      </Text>
    </>
  );
  if (!interactive) {
    return <View style={[styles.chip, style]}>{face}</View>;
  }
  return (
    <PlanDrag.Source
      payload={task}
      hold="row"
      testID={`week-task:${task.name}`}
      style={[styles.chip, style]}
    >
      {face}
    </PlanDrag.Source>
  );
}

/** The hidden-task count. Live, it is its own 44pt press that opens
    the day and does not select it. */
function More({
  day,
  hidden,
  interactive,
  onOpenDay,
  style,
}: {
  day: WeekDay;
  hidden: number;
  interactive: boolean;
  onOpenDay?: (date: Date) => void;
  style: StyleProp<ViewStyle>;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const text = <Text style={styles.moreText}>{`+${hidden}`}</Text>;
  if (!interactive) {
    return <View style={[styles.more, style]}>{text}</View>;
  }
  return (
    <Pressable
      style={[styles.more, style]}
      onPress={() => onOpenDay?.(day.date)}
      accessibilityRole="button"
      accessibilityLabel={`+${hidden} more on ${WEEKDAYS_FULL[day.date.getDay()]} ${day.date.getDate()}, open the day`}
    >
      {text}
    </Pressable>
  );
}

/** The box's drop ring, on the live page only. */
function DropRing({ day, cell, interactive }: { day: WeekDay; cell: number; interactive: boolean }) {
  return interactive ? <PlanDrag.Ring cell={cell} testID={`week-ring:${day.iso}`} /> : null;
}

/**
 * A Spread box: the day's name and date over two chips. The "+N" count
 * sits at the header's right, and its 44pt press keeps the chips clear
 * of it. The name and the date carry non-breaking spaces, so the box's
 * accessible name keeps its words apart from the task text.
 */
function SpreadDay({ day, cell, span, interactive, onSelect, onOpenDay }: DayProps) {
  const { styles } = useThemedStyles(makeStyles);
  const shown = weekChipCount(day.items.length);
  const hidden = day.items.length - shown;
  return (
    <DayBox
      day={day}
      interactive={interactive}
      onSelect={onSelect}
      style={[
        styles.box,
        { flex: span },
        day.isSelected && styles.boxSelected,
        day.isToday && styles.boxToday,
      ]}
      content={styles.boxContent}
      more={
        hidden > 0 ? (
          <More
            day={day}
            hidden={hidden}
            interactive={interactive}
            onOpenDay={onOpenDay}
            style={styles.spreadMore}
          />
        ) : null
      }
      ring={<DropRing day={day} cell={cell} interactive={interactive} />}
    >
      <View style={styles.head}>
        <Text style={[styles.caption, day.isToday && styles.captionToday]}>
          {day.isToday ? "Today" : WEEKDAYS[day.date.getDay()]}
        </Text>
        <Text style={[styles.headDate, day.isToday && styles.dateToday]}>
          {`\u00a0${day.date.getDate()}\u00a0`}
        </Text>
      </View>
      <View style={[styles.spreadChips, hidden > 0 && styles.spreadChipsBesideMore]}>
        {day.items.slice(0, shown).map((task) => (
          <Chip key={task.id} task={task} interactive={interactive} style={styles.spreadChip} />
        ))}
      </View>
    </DayBox>
  );
}

/**
 * A Rows line: the date block, two chips side by side, then the "+N"
 * count. Every line keeps both chip slots and the count's slot, so the
 * chips line up down the card.
 */
function RowsDay({ day, cell, interactive, onSelect, onOpenDay }: DayProps) {
  const { styles } = useThemedStyles(makeStyles);
  const shown = weekChipCount(day.items.length);
  const hidden = day.items.length - shown;
  const chips = day.items.slice(0, shown);
  return (
    <DayBox
      day={day}
      interactive={interactive}
      onSelect={onSelect}
      style={[styles.line, day.isToday && styles.lineToday]}
      content={styles.lineContent}
      more={
        hidden > 0 ? (
          <More
            day={day}
            hidden={hidden}
            interactive={interactive}
            onOpenDay={onOpenDay}
            style={styles.lineMore}
          />
        ) : null
      }
      ring={<DropRing day={day} cell={cell} interactive={interactive} />}
    >
      {cell > 0 ? <View style={styles.rule} /> : null}
      <View style={styles.dateBlock}>
        <Text style={styles.caption}>{WEEKDAYS[day.date.getDay()]}</Text>
        <Text style={[styles.lineDate, day.isToday && styles.dateToday]}>
          {`\u00a0${day.date.getDate()}\u00a0`}
        </Text>
      </View>
      <View style={styles.lineChips}>
        {[0, 1].map((slot) =>
          chips[slot] === undefined ? (
            <View key={`empty-${slot}`} style={styles.lineSlot} />
          ) : (
            <Chip
              key={chips[slot].id}
              task={chips[slot]}
              interactive={interactive}
              style={[styles.lineSlot, styles.lineChip]}
            />
          ),
        )}
      </View>
      <View style={styles.moreSlot} />
      {day.isSelected || day.isToday ? (
        <View pointerEvents="none" style={[styles.fill, styles.edge]} />
      ) : null}
    </DayBox>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    fill: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    root: {
      flexGrow: 1,
    },
    grid: {
      flexDirection: "column",
      flexGrow: 1,
    },
    spreadGrid: {
      gap: spreadBox.gap,
    },
    row: {
      flex: 1,
      flexDirection: "row",
      gap: spreadBox.gap,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    caption: {
      ...type.caption,
      color: colors.inkMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    captionToday: {
      color: colors.accent,
      fontWeight: "700",
    },
    dateToday: {
      color: colors.accent,
      fontWeight: "700",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.paper,
      borderRadius: radius,
    },
    bar: {
      width: 3,
      height: 10,
      borderRadius: 1.5,
      backgroundColor: colors.accent,
    },
    chipText: {
      ...type.caption,
      flex: 1,
      color: colors.ink,
    },
    more: {
      width: touchTarget,
      height: touchTarget,
    },
    moreText: {
      ...type.caption,
      color: colors.accent,
      fontWeight: "600",
    },

    // Spread: boxes in pairs, and the gap between them stays paper.
    box: {
      minHeight: spreadBox.height,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: radius,
    },
    boxContent: {
      gap: spacing.xs,
      padding: spacing.xs,
    },
    boxSelected: {
      borderColor: colors.accent,
    },
    boxToday: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    head: {
      height: spreadBox.header,
      flexDirection: "row",
      alignItems: "baseline",
    },
    headDate: {
      fontSize: 13,
      lineHeight: spreadBox.header,
      fontFamily: fonts.display,
      color: colors.ink,
    },
    spreadChips: {
      gap: spacing.xs,
    },
    // The count's press takes the box's top right corner, so the chips
    // end where it starts.
    spreadChipsBesideMore: {
      paddingRight: touchTarget - spacing.xs,
    },
    spreadChip: {
      height: spreadBox.chip,
    },
    spreadMore: {
      position: "absolute",
      top: 0,
      right: 0,
      alignItems: "flex-end",
      paddingTop: spacing.xs,
      paddingRight: spacing.xs,
    },

    // Rows: seven lines in one card, split by hairlines.
    card: {
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: radius,
    },
    line: {
      flex: 1,
      minHeight: rowsLine.height,
    },
    lineToday: {
      backgroundColor: colors.accentSoft,
    },
    lineContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingLeft: spacing.s,
    },
    // The rule draws over the line's top edge and takes no height, so
    // every line keeps one touch target.
    rule: {
      position: "absolute",
      top: 0,
      right: 0,
      left: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.hairline,
    },
    // The picked day's edge draws over the line, so it moves nothing.
    edge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent,
      borderRadius: radius,
    },
    dateBlock: {
      width: rowsLine.date,
      alignItems: "center",
    },
    lineDate: {
      fontSize: 15,
      lineHeight: 18,
      fontFamily: fonts.display,
      color: colors.ink,
    },
    lineChips: {
      flex: 1,
      flexDirection: "row",
      gap: spacing.xs,
    },
    lineSlot: {
      flex: 1,
      minWidth: 0,
    },
    lineChip: {
      height: rowsLine.chip,
    },
    moreSlot: {
      width: touchTarget,
    },
    lineMore: {
      position: "absolute",
      top: 0,
      right: 0,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
});
