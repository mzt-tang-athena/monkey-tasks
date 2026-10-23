import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { addDays, startOfDay, isSameDay } from "../../../lib/dates";
import {
  dayIndexBetween,
  isoWeek,
  railStartIdx,
  startOfWeek,
  type Mode,
} from "../model";
import { MONTHS, MONTHS_SHORT, WEEKDAYS, WEEKDAYS_FULL } from "../lib/labels";
import {
  colors,
  fonts,
  pageGutter,
  periodStep,
  radius,
  spacing,
} from "../../../theme/tokens";

const styles = StyleSheet.create({
  pressedFill: {
    backgroundColor: colors.pressed,
  },
  // period strip: day cells, then the wider week and month cells
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.s,
  },
  stripScroll: {
    flexDirection: "row",
    gap: spacing.s,
    alignItems: "flex-end",
    // The same bottom spacing the day strip has, so the wide strips
    // never touch the pills. Page grid inside, screen-edge bleed
    // outside: the rail cuts at the display, not the gutter.
    marginBottom: spacing.s,
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
  },
  stripDay: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: radius,
  },
  stripDayActive: {
    // The selected tab hangs from the screen's top edge: square top,
    // rounded bottom, standing taller than its resting neighbours.
    height: 52,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: colors.accent,
  },
  stripDayToday: {
    backgroundColor: colors.accentSoft,
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
  stripNameToday: {
    color: colors.accent,
    fontWeight: "600",
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
  stripNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  // The period rail bleeds past the page gutter: cells cut at the
  // display's edges, scrolling until the last one clears the grid.
  railBleed: {
    marginHorizontal: -pageGutter,
  },
});


/**
 * One horizontally scrolling period rail (weeks or months). It
 * auto-scrolls only when the active cell leaves the viewport, so
 * ordinary use never moves the rail without the user asking.
 */
function PeriodRail({
  count,
  activeIdx,
  renderItem,
}: {
  count: number;
  activeIdx: number;
  renderItem: (index: number) => React.ReactNode;
}) {
  // stripDay 44 + one gap 8: the rail's cell step. The token keeps
  // the alignment math honest when a pill tune lands.
  const STEP = periodStep;
  const scroller = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewport = React.useRef(0);
  const railX = React.useRef(0);

  // Align only when the active cell sits outside the viewport: the
  // rail never moves on its own otherwise. Cells live at
  // pageGutter + i * STEP inside the padded rail content, so both
  // the boundary test and the targets carry the gutter offset.
  const alignToActive = React.useCallback(() => {
    if (viewport.current <= 0) {
      return;
    }
    const lo = Math.floor((railX.current - pageGutter) / STEP);
    const hi = Math.floor((railX.current - pageGutter + viewport.current) / STEP);
    if (activeIdx < lo) {
      const x = pageGutter + activeIdx * STEP;
      railX.current = x;
      scroller.current?.scrollTo({ x, animated: false });
    } else if (activeIdx > hi - 1) {
      const x = Math.max(pageGutter + (activeIdx + 1) * STEP - viewport.current, 0);
      railX.current = x;
      scroller.current?.scrollTo({ x, animated: false });
    }
  }, [activeIdx]);

  // Mount: week and month share this component, and several browser
  // engines carry a stale horizontal offset into a remounted scroller.
  // Start clean at the anchor, then align if the cell is already off.
  React.useLayoutEffect(() => {
    scroller.current?.scrollTo({ x: 0, animated: false });
    railX.current = 0;
  }, []);
  React.useLayoutEffect(alignToActive, [activeIdx, alignToActive, STEP]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.railBleed}
      contentContainerStyle={styles.stripScroll}
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.width;
        // First real measurement may already need an alignment.
        alignToActive();
      }}
      onScroll={(e) => {
        railX.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={64}
    >
      {Array.from({ length: count }, (_, index) => renderItem(index))}
    </ScrollView>
  );
}

/**
 * The period strip above the pills. Day mode shows the seven days
 * containing the selected day; week and month show a scrolling rail.
 * The current period is tinted, the selected period is filled, and a
 * tap jumps to it. Selection drifts make the rails follow lazily.
 */
export function PeriodStrip({
  mode,
  selected,
  today,
  onSelect,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
}) {
  const todayStart = startOfDay(today).getTime();
  const selStart = startOfDay(selected).getTime();

  if (mode === "day") {
    // The 7-day window containing the selected day: today-first
    // while the selection stays inside today's block, then the rail
    // walks one day per step off either edge.
    const selIdx = dayIndexBetween(todayStart, selStart);
    const startIdx = railStartIdx(0, selIdx, 7);
    const days = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
      addDays(today, startIdx + offset),
    );
    return (
      <View style={styles.strip}>
        {days.map((day) => {
          const active = isSameDay(day, selected);
          const isToday = startOfDay(day).getTime() === todayStart;
          return (
            <Pressable
              key={day.getTime()}
              style={({ pressed }) => [
                styles.stripDay,
                active && styles.stripDayActive,
                isToday && !active && styles.stripDayToday,
                pressed && styles.pressedFill,
              ]}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAYS_FULL[day.getDay()]} ${day.getDate()}`}
            >
              <Text
                style={[
                  styles.stripName,
                  active && styles.stripNameActive,
                  isToday && !active && styles.stripNameToday,
                ]}
              >
                {WEEKDAYS[day.getDay()]}
              </Text>
              <Text
                style={[
                  styles.stripNum,
                  active && styles.stripNumActive,
                  isToday && !active && styles.stripNumToday,
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

  if (mode === "week") {
    // One week per cell, current week first, rail rebasing per the
    // lazy-follow rule when the selected week walks off its end.
    const selWeekIdx = Math.round(
      (startOfWeek(selected).getTime() - startOfWeek(today).getTime()) /
        (7 * 86400000),
    );
    const startIdx = railStartIdx(0, selWeekIdx, 12);
    const railBase = startOfWeek(today);
    return (
      <PeriodRail
        key="week"
        count={12}
        activeIdx={selWeekIdx - startIdx}
        renderItem={(index) => {
          const weekStartDay = addDays(railBase, 7 * (startIdx + index));
          const weekEnd = addDays(weekStartDay, 6);
          const startT = weekStartDay.getTime();
          const endT = weekEnd.getTime();
          const active = selStart >= startT && selStart <= endT;
          const isCurrent = todayStart >= startT && todayStart <= endT;
          return (
            <Pressable
              key={startT}
              style={({ pressed }) => [
                styles.stripDay,
                active && styles.stripDayActive,
                isCurrent && !active && styles.stripDayToday,
                pressed && styles.pressedFill,
              ]}
              onPress={() => onSelect(weekStartDay)}
              accessibilityRole="button"
              accessibilityLabel={`week of ${MONTHS_SHORT[weekStartDay.getMonth()]} ${weekStartDay.getDate()}-${weekEnd.getDate()}`}
            >
              <Text
                style={[
                  styles.stripName,
                  active && styles.stripNameActive,
                  isCurrent && !active && styles.stripNameToday,
                ]}
              >
                {`${weekStartDay.getDate()}-${weekEnd.getDate()}`}
              </Text>
              <Text
                style={[
                  styles.stripNum,
                  active && styles.stripNumActive,
                  isCurrent && !active && styles.stripNumToday,
                ]}
              >
                {`W${isoWeek(addDays(weekStartDay, 3))}`}
              </Text>
            </Pressable>
          );
        }}
      />
    );
  }

  // Month mode: a rail of 12 months, current month first, rebasing
  // per the lazy-follow rule. Cells mirror the day strip's anatomy:
  // the year small on top, the month word below it.
  const selMonthIdx =
    selected.getFullYear() * 12 + selected.getMonth();
  const todayMonthIdx = today.getFullYear() * 12 + today.getMonth();
  // Indexes are relative to today's month, so the rebase rule never
  // sees calendar-sized offsets.
  const selRelMonthIdx = selMonthIdx - todayMonthIdx;
  const startIdx = railStartIdx(0, selRelMonthIdx, 12);
  const railYear = today.getFullYear();
  const railMonth = today.getMonth() + startIdx;
  return (
    <PeriodRail
      key="month"
      count={12}
      activeIdx={selRelMonthIdx - startIdx}
      renderItem={(index) => {
        const monthStartDay = new Date(railYear, railMonth + index, 1);
        const active =
          selected.getFullYear() === monthStartDay.getFullYear() &&
          selected.getMonth() === monthStartDay.getMonth();
        const isCurrent =
          today.getFullYear() === monthStartDay.getFullYear() &&
          today.getMonth() === monthStartDay.getMonth();
        return (
          <Pressable
            key={monthStartDay.getTime()}
            style={({ pressed }) => [
              styles.stripDay,
              active && styles.stripDayActive,
              isCurrent && !active && styles.stripDayToday,
              pressed && styles.pressedFill,
            ]}
            onPress={() => onSelect(monthStartDay)}
            accessibilityRole="button"
            accessibilityLabel={`${MONTHS[monthStartDay.getMonth()]} ${monthStartDay.getFullYear()}`}
          >
            <Text
              style={[
                styles.stripName,
                active && styles.stripNameActive,
                isCurrent && !active && styles.stripNameToday,
              ]}
            >
              {monthStartDay.getFullYear()}
            </Text>
            <Text
              style={[
                styles.stripNum,
                active && styles.stripNumActive,
                isCurrent && !active && styles.stripNumToday,
              ]}
            >
              {MONTHS_SHORT[monthStartDay.getMonth()]}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
