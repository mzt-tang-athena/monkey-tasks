import * as React from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import {
  MotionScrollView,
  type MotionScrollRef,
} from "@/components/motion/scroll-view";
import { PeriodMark, type MarkPlace } from "@/components/motion/period-mark";
import type { PageFollow } from "@/components/motion/page-follow";
import { Pressable } from "@/components/ui/pressable";
import { addDays, startOfDay } from "@/utils/dates";
import {
  dayIndexBetween,
  isoWeek,
  railStartIdx,
  startOfWeek,
  type Mode,
} from "@/features/planner/model";
import { MONTHS_SHORT, WEEKDAYS } from "@/features/planner/lib/labels";
import { useSetting } from "@/lib/settings-store";
import {
  fonts,
  pageGutter,
  periodStep,
  radius,
  spacing,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    pressed: {
      backgroundColor: colors.pressed,
    },
    // period strip: one row of cells, with the selected mark and a copy
    // of the labels riding over it
    row: {
      flexDirection: "row",
      position: "relative",
    },
    // Day fills its frame: the seven cells spread across the width.
    spread: {
      justifyContent: "space-between",
    },
    // The rails sit at one step between cells, and scroll.
    gap: {
      gap: spacing.s,
    },
    rail: {
      // Page grid inside, screen edge outside: the rail sits in a frame
      // with no gutter, so it cuts at the display, not the gutter.
      paddingLeft: pageGutter,
      paddingRight: pageGutter,
    },
    // The mark hangs from the top edge, so a cell is as tall as it is.
    cell: {
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      width: 44,
      height: 52,
      borderRadius: radius,
    },
    // The tint under a resting cell, one step shorter than the mark.
    today: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 44,
      borderRadius: radius,
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
    },
    stripNumActive: {
      color: colors.onAccent,
      fontWeight: "600",
    },
    stripNumToday: {
      color: colors.accent,
      fontWeight: "700",
    },
  }),
});

type StripStyles = ReturnType<typeof makeStyles>["styles"];

/** One period cell: the small name over the number. `lit` paints the
    copy that the mark clips to itself, so it takes the accent's ink. */
function CellLines({
  styles,
  top,
  bottom,
  lit = false,
  today = false,
}: {
  styles: StripStyles;
  top: string;
  bottom: string;
  lit?: boolean;
  today?: boolean;
}) {
  return (
    <>
      <Text
        style={[
          styles.stripName,
          lit && styles.stripNameActive,
          today && styles.stripNameToday,
        ]}
      >
        {top}
      </Text>
      <Text
        style={[
          styles.stripNum,
          lit && styles.stripNumActive,
          today && styles.stripNumToday,
        ]}
      >
        {bottom}
      </Text>
    </>
  );
}

/** One cell of a period strip: what it shows, and what a tap does. */
type PeriodCell = {
  key: string;
  top: string;
  bottom: string;
  /** The name assistive tech reads. */
  label: string;
  /** The period today falls in. */
  current: boolean;
  onPress: () => void;
};

/** Each cell's place in its row, from layout. A cell keeps its place
    while the strip shows, so one measure is enough. */
function usePlaces(count: number) {
  const [places, setPlaces] = React.useState<Record<number, MarkPlace>>({});
  const slots = React.useMemo(
    () => Array.from({ length: count }, (_, index) => places[index] ?? null),
    [places, count],
  );
  const measure = React.useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setPlaces((current) => {
        const was = current[index];
        if (was != null && was.x === x && was.width === width) {
          return current;
        }
        return { ...current, [index]: { x, width } };
      });
    },
    [],
  );
  return { slots, measure };
}

/**
 * A `count` wide window on a period index, and whether the selection
 * sits inside today's own window. Inside it the window holds still and
 * the mark rides the swipe. Past either end the window follows the day,
 * so the dates slide under a mark that stays put (ADR 0046).
 */
function useWindow(count: number, selIdx: number) {
  return {
    start: railStartIdx(0, selIdx, count),
    rides: selIdx >= 0 && selIdx <= count - 1,
  };
}

/** The row's width, so the mark's copied labels lay out where the row's
    own do. */
function useRowWidth() {
  const [width, setWidth] = React.useState(0);
  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((was) => (was === next ? was : next));
  }, []);
  return { width, onLayout };
}

/**
 * A row of period cells with the selected mark, which rides the pager
 * when the strip is handed a follow (ADR 0046). The cells spread
 * across their frame in Day, and sit at one step apart in the rails.
 */
function PeriodRow({
  cells,
  activeIdx,
  follow,
  rides = true,
  label,
  spread = false,
  testID,
}: {
  cells: PeriodCell[];
  /** The cell holding the period on screen: where the mark rests. */
  activeIdx: number;
  follow?: PageFollow;
  /** False where the window follows the day, so the mark stays put. */
  rides?: boolean;
  label: string;
  spread?: boolean;
  testID: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { slots, measure } = usePlaces(cells.length);
  const row = useRowWidth();
  const layout = spread ? styles.spread : styles.gap;

  return (
    <View
      style={[styles.row, layout]}
      onLayout={row.onLayout}
      role="tablist"
      aria-label={label}
    >
      {cells.map((cell, index) => {
        const selected = index === activeIdx;
        const today = cell.current && !selected;
        return (
          <Pressable
            key={cell.key}
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            onLayout={measure(index)}
            onPress={cell.onPress}
            role="tab"
            aria-selected={selected}
            accessibilityLabel={cell.label}
          >
            {today ? <View style={styles.today} /> : null}
            <CellLines
              styles={styles}
              top={cell.top}
              bottom={cell.bottom}
              today={today}
            />
          </Pressable>
        );
      })}
      <PeriodMark
        follow={follow}
        at={activeIdx}
        places={slots}
        rides={rides}
        testID={testID}
      >
        {/* The same labels in the accent's ink, clipped by the mark. */}
        <View style={[styles.row, layout, { width: row.width }]}>
          {cells.map((cell) => (
            <View key={cell.key} style={styles.cell}>
              <CellLines styles={styles} top={cell.top} bottom={cell.bottom} lit />
            </View>
          ))}
        </View>
      </PeriodMark>
    </View>
  );
}

/**
 * One horizontally scrolling period rail (weeks or months). It
 * auto-scrolls only when the active cell leaves the viewport, so
 * ordinary use never moves the rail without the user asking.
 */
function PeriodRail({
  count,
  selIdx,
  cell,
  follow,
  label,
}: {
  count: number;
  /** The selection's index in the rail's own period space. */
  selIdx: number;
  /** The cell at one period index of the rail. */
  cell: (index: number) => PeriodCell;
  follow?: PageFollow;
  label: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const { start: startIdx, rides } = useWindow(count, selIdx);
  const activeIdx = selIdx - startIdx;
  const cells = Array.from({ length: count }, (_, index) => cell(startIdx + index));
  const scroller = React.useRef<MotionScrollRef | null>(null);
  const viewport = React.useRef(0);
  const railX = React.useRef(0);

  // Align only when the active cell sits outside the viewport: the
  // rail never moves on its own otherwise. Cells live at
  // pageGutter + i * periodStep inside the padded rail content (one
  // 44 cell plus one 8 gap per step), so both the boundary test and
  // the targets carry the gutter offset.
  const alignToActive = React.useCallback(() => {
    if (viewport.current <= 0) {
      return;
    }
    const lo = Math.floor((railX.current - pageGutter) / periodStep);
    const hi = Math.floor((railX.current - pageGutter + viewport.current) / periodStep);
    if (activeIdx < lo) {
      const x = pageGutter + activeIdx * periodStep;
      railX.current = x;
      scroller.current?.scrollTo({ x, animated: false });
    } else if (activeIdx > hi - 1) {
      const x = Math.max(pageGutter + (activeIdx + 1) * periodStep - viewport.current, 0);
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
  React.useLayoutEffect(alignToActive, [activeIdx, alignToActive]);

  return (
    <MotionScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
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
      <PeriodRow
        cells={cells}
        activeIdx={activeIdx}
        follow={follow}
        rides={rides}
        label={label}
        testID={`${label}-mark`}
      />
    </MotionScrollView>
  );
}

/** The seven days around the selected one. The window opens on today's
    block and walks one day per step off either edge. */
function DayStrip({
  selected,
  today,
  onSelect,
  follow,
}: {
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  follow?: PageFollow;
}) {
  const todayStart = startOfDay(today).getTime();
  const selIdx = dayIndexBetween(todayStart, startOfDay(selected).getTime());
  const { start: startIdx, rides } = useWindow(7, selIdx);
  const cells = [0, 1, 2, 3, 4, 5, 6].map((index) => {
    const day = addDays(today, startIdx + index);
    return {
      key: String(day.getTime()),
      // The number carries a non-breaking space, so the cell's name
      // joins the weekday and the day as two words.
      top: WEEKDAYS[day.getDay()],
      bottom: `\u00a0${day.getDate()}`,
      label: `${WEEKDAYS[day.getDay()]} ${day.getDate()}`,
      current: startOfDay(day).getTime() === todayStart,
      onPress: () => onSelect(day),
    };
  });
  return (
    <PeriodRow
      cells={cells}
      activeIdx={selIdx - startIdx}
      follow={follow}
      rides={rides}
      label="days"
      spread
      testID="days-mark"
    />
  );
}

/**
 * The period strip above the pills. Day mode shows the seven days
 * containing the selected day; week and month show a scrolling rail.
 * The current period is tinted, the selected period is filled, and a
 * tap jumps to it. Selection drifts make the rails follow lazily. With
 * a page follow the filled mark rides the swipe, and stays where a
 * cancelled swipe leaves it (ADR 0046).
 */
export function PeriodStrip({
  mode,
  selected,
  today,
  onSelect,
  follow,
}: {
  mode: Mode;
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  /** The planner pager whose swipe the mark rides. */
  follow?: PageFollow;
}) {
  const [weekStart] = useSetting("weekStart");
  const todayStart = startOfDay(today).getTime();

  if (mode === "day") {
    return (
      <DayStrip
        selected={selected}
        today={today}
        onSelect={onSelect}
        follow={follow}
      />
    );
  }

  if (mode === "week") {
    const selIdx = Math.round(
      (startOfWeek(selected, weekStart).getTime() -
        startOfWeek(today, weekStart).getTime()) /
        (7 * 86400000),
    );
    const railBase = startOfWeek(today, weekStart);
    return (
      <PeriodRail
        count={12}
        selIdx={selIdx}
        follow={follow}
        label="weeks"
        cell={(index) => {
          const first = addDays(railBase, 7 * index);
          const last = addDays(first, 6);
          const week = isoWeek(addDays(first, 3));
          return {
            key: String(first.getTime()),
            top: `${first.getDate()}-${last.getDate()}`,
            bottom: `\u00a0W${week}`,
            label:
              `week of ${MONTHS_SHORT[first.getMonth()]} ` +
              `${first.getDate()}-${last.getDate()} W${week}`,
            current: todayStart >= first.getTime() && todayStart <= last.getTime(),
            onPress: () => onSelect(first),
          };
        }}
      />
    );
  }

  // Month mode: a rail of 12 months, anchored at today's month. Cells
  // mirror the day strip's anatomy: the year small on top, the month
  // word below it.
  const selIdx =
    selected.getFullYear() * 12 +
    selected.getMonth() -
    (today.getFullYear() * 12 + today.getMonth());
  const railYear = today.getFullYear();
  const railMonth = today.getMonth();
  return (
    <PeriodRail
      count={12}
      selIdx={selIdx}
      follow={follow}
      label="months"
      cell={(index) => {
        const month = new Date(railYear, railMonth + index, 1);
        return {
          key: String(month.getTime()),
          top: `${month.getFullYear()}`,
          bottom: `\u00a0${MONTHS_SHORT[month.getMonth()]}`,
          label: `${month.getFullYear()} ${MONTHS_SHORT[month.getMonth()]}`,
          current:
            today.getFullYear() === month.getFullYear() &&
            today.getMonth() === month.getMonth(),
          onPress: () => onSelect(month),
        };
      }}
    />
  );
}
