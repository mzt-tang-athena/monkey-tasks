import * as React from "react";
import { View } from "react-native";
import type { TaskItem } from "@/types/task";
import { Pager } from "@/components/motion/pager";
import { addDays, startOfDay } from "@/utils/dates";
import { dayRows } from "@/features/planner/lib/day-rows";
import { dayIndexBetween, type Mode } from "@/features/planner/model";
import { PlannerHeader } from "../planner-header";
import { usePlannerList } from "../planner-list-context";
import { layout } from "../../planner-layout";
import { DayPage } from "./day-page";
import { DayPreview } from "./day-preview";

/** The pager's flex slot, directly under the stationary header. */
const bodyFrame = { flex: 1 } as const;

/**
 * The day composition: the stationary header, and under it the pager
 * that slides the day body. A swipe on the body turns the day. The
 * date strip and the mode switch stay still.
 *
 * The pager's cell and the preview both read `dayRows` and one `now`,
 * so a recurring task and the now line do not shift when a page lands.
 */
export function DaySpread({
  date,
  today,
  tasks,
  fraction,
  onResize,
  onMode,
  onSelectStrip,
  onSelectDay,
}: {
  date: Date;
  today: Date;
  tasks: TaskItem[];
  /** The day's split, shared by the live page and the preview. */
  fraction: number;
  onResize: (fraction: number) => void;
  onMode: (mode: Mode) => void;
  onSelectStrip: (date: Date) => void;
  /** A strip tap or a page landing picks the day. */
  onSelectDay: (date: Date) => void;
}) {
  const live = usePlannerList();
  const { source, taskForm } = live;

  // The day index counts from the day this screen mounted. The pager
  // reads it, and a landing writes the day back through the screen.
  const [origin] = React.useState(() => startOfDay(date));
  const index = dayIndexBetween(origin.getTime(), startOfDay(date).getTime());

  // One clock for the live page and its preview: the now line must not
  // move when the page lands. It steps once a minute.
  const [now, setNow] = React.useState(
    () => new Date(Math.floor(Date.now() / 60_000) * 60_000),
  );
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date(Math.floor(Date.now() / 60_000) * 60_000));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // The day's rows. The live page and the preview read the same
  // function, so a recurrence shows in both.
  const rows = React.useMemo(
    () => dayRows({ tasks, day: date, today, source, taskForm }),
    [tasks, date, today, source, taskForm],
  );

  // Each day keeps its own scroll. A page starts at the top the first
  // time it shows, and returns to its saved offset on a later visit.
  // The neighbour preview draws at the saved offset of the page it
  // becomes, so the landing moves nothing vertically.
  // The map mutates in place. A scroll must not re-render the day: it
  // only records where the page stands for its next visit.
  const [offsets] = React.useState(
    () => new Map<number, { timeline: number; list: number }>(),
  );
  const saved = React.useCallback(
    (page: number) => offsets.get(page) ?? { timeline: 0, list: 0 },
    [offsets],
  );
  const restore = saved(index);
  const store = React.useCallback(
    (pane: "timeline" | "list", y: number) => {
      offsets.set(index, { ...saved(index), [pane]: y });
    },
    [index, offsets, saved],
  );
  const onTimelineScroll = React.useCallback(
    (y: number) => store("timeline", y),
    [store],
  );
  const onListScroll = React.useCallback((y: number) => store("list", y), [store]);

  const onPage = React.useCallback(
    (next: number) => onSelectDay(addDays(origin, next)),
    [onSelectDay, origin],
  );

  return (
    <View style={layout.dayRoot}>
      <PlannerHeader
        mode="day"
        selected={date}
        today={today}
        onSelect={onSelectStrip}
        onMode={onMode}
      />
      {/* The pager sits under the header: only the day body slides,
          so the date strip and the mode switch never move. */}
      <View style={bodyFrame}>
        <Pager
          testID="day-pager"
          index={index}
          onPage={onPage}
          renderPreview={(page) => (
            <DayPreview
              date={addDays(origin, page)}
              today={today}
              tasks={tasks}
              now={now}
              fraction={fraction}
              scroll={saved(page)}
            />
          )}
          fill
        >
          <DayPage
            date={date}
            today={today}
            rows={rows}
            now={now}
            fraction={fraction}
            onResize={onResize}
            onTimelineScroll={onTimelineScroll}
            onListScroll={onListScroll}
            restorePage={index}
            restoreTimeline={restore.timeline}
            restoreList={restore.list}
          />
        </Pager>
      </View>
    </View>
  );
}
