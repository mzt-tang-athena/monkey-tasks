import * as React from "react";
import { Animated, Platform, StyleSheet } from "react-native";
import type { TaskItem } from "@/types/task";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { drag } from "@/theme/tokens";
import type { ListsSection } from "../lib/list-sections";
import { layoutOrder, moveItem, reorderItems } from "../lib/reorder";

/** What a row's host view offers for a measure. */
type Measurable = {
  measureInWindow?: (
    cb: (x: number, y: number, w: number, h: number) => void,
  ) => void;
} | null;

/** The lifted row: where it came from, where it would land, and where
    it sits on screen. */
export type Lifted = {
  task: TaskItem;
  /** The key of the group the row lives in. */
  section: string;
  from: number;
  to: number;
  /** The row's left edge and width, in window coordinates. */
  left: number;
  width: number;
};

/** How long a slide to a new slot takes, in ms. */
const slideMs = 220;

/**
 * The manual reorder. A hold (or the grip) lifts a row, the rows
 * reflow live under it, and the drop writes `order` for the rows whose
 * position changed. The floating row moves through an Animated value,
 * so a pointer move costs no render.
 *
 * Every handler has one identity for the screen's life, so a memoized
 * row never re-renders for them. A row reads its own slide through
 * `shiftOf`, and tells the hook where its view is through `registerRow`.
 */
export function useRowReorder({
  sections,
  write,
  claimSwipe,
  onDrop,
}: {
  /** The groups on screen, before a settling drop. */
  sections: ListsSection[];
  /** One drop is one write: it lands whole or rolls back whole. */
  write: (changes: ReturnType<typeof reorderItems>) => Promise<unknown>;
  /** The reorder owns the gesture now, not the tab swipe. */
  claimSwipe: () => void;
  /** The drop ended. The click that follows must not open the row. */
  onDrop: () => void;
}) {
  const [lifted, setLifted] = React.useState<Lifted | null>(null);
  const [ghostY] = React.useState(() => new Animated.Value(0));
  // One translateY per row: the slide from the old place to the new.
  const [shifts] = React.useState(() => new Map<string, Animated.Value>());
  // Where each row is heading, so a crossing only animates the rows
  // whose slot actually changed.
  const targets = React.useRef(new Map<string, number>());
  // The sequence the last drop wrote, held on screen until every note
  // is saved: the rows must not snap back while the writes land.
  const [settling, setSettling] = React.useState<{
    section: string;
    data: TaskItem[];
  } | null>(null);
  const grabOffset = React.useRef(0);
  const rowViews = React.useRef(new Map<string, Measurable>());
  const rects = React.useRef<{ uri: string; y: number; h: number }[]>([]);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<{
    task: TaskItem;
    section: string;
    x: number;
    y: number;
  } | null>(null);

  const itemsOf = (key: string) =>
    sections.find((section) => section.key === key)?.data ?? [];

  const clearHold = React.useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);
  React.useEffect(() => clearHold, [clearHold]);

  const resetShifts = React.useCallback(() => {
    targets.current.clear();
    for (const value of shifts.values()) {
      value.stopAnimation();
      value.setValue(0);
    }
  }, [shifts]);

  const registerRow = React.useCallback((uri: string, node: Measurable) => {
    if (node == null) {
      rowViews.current.delete(uri);
    } else {
      rowViews.current.set(uri, node);
    }
  }, []);

  /** The row's slide value. It exists from the first ask. */
  const shiftOf = React.useCallback(
    (uri: string) => {
      let value = shifts.get(uri);
      if (value == null) {
        value = new Animated.Value(0);
        shifts.set(uri, value);
      }
      return value;
    },
    [shifts],
  );

  const arm = useStableCallback(() => {
    const start = pending.current;
    if (start == null) {
      return;
    }
    pending.current = null;
    clearHold();
    setSettling(null);
    resetShifts();
    claimSwipe();
    const items = itemsOf(start.section);
    const from = items.findIndex((item) => item.uri === start.task.uri);
    if (from === -1) {
      return;
    }
    rects.current = [];
    for (const item of items) {
      rowViews.current.get(item.uri)?.measureInWindow?.((x, y, w, h) => {
        rects.current.push({ uri: item.uri, y, h });
        if (item.uri === start.task.uri) {
          grabOffset.current = start.y - y;
          ghostY.setValue(y);
          setLifted({
            task: start.task,
            section: start.section,
            from,
            to: from,
            left: x,
            width: w,
          });
        }
      });
    }
  });

  /** The finger landed on a row: the hold clock starts. */
  const holdRow = useStableCallback(
    (task: TaskItem, section: string, e: { pageX: number; pageY: number }) => {
      pending.current = { task, section, x: e.pageX, y: e.pageY };
      clearHold();
      holdTimer.current = setTimeout(arm, drag.pickMs);
    },
  );

  /** The grip, or a hold that already elapsed: lift the row now. */
  const pickupRow = useStableCallback(
    (task: TaskItem, section: string, x: number, y: number) => {
      pending.current = { task, section, x, y };
      arm();
    },
  );

  const moveRow = useStableCallback((x: number, y: number) => {
    if (lifted == null) {
      const start = pending.current;
      if (
        start != null &&
        Math.abs(x - start.x) + Math.abs(y - start.y) > drag.threshold
      ) {
        pending.current = null;
        clearHold();
      }
      return;
    }
    // A live drag owns the gesture: the tab swipe must not arm.
    claimSwipe();
    ghostY.setValue(y - grabOffset.current);
    const sorted = [...rects.current].sort((a, b) => a.y - b.y);
    if (sorted.length === 0) {
      return;
    }
    let to = sorted.length;
    for (let i = 0; i < sorted.length; i += 1) {
      if (y < sorted[i].y + sorted[i].h / 2) {
        to = i;
        break;
      }
    }
    if (to === lifted.to) {
      return;
    }
    // The list keeps its order; every row slides to where it would be.
    // Nothing is reordered while a finger is down, so nothing can
    // blink.
    const items = itemsOf(lifted.section);
    const gap = StyleSheet.hairlineWidth;
    const base = layoutOrder(items, rects.current, gap);
    const preview = layoutOrder(
      moveItem(items, lifted.from, to),
      rects.current,
      gap,
    );
    for (const [uri, at] of base) {
      const target = (preview.get(uri) ?? at) - at;
      if (targets.current.get(uri) === target) {
        continue;
      }
      targets.current.set(uri, target);
      Animated.timing(shiftOf(uri), {
        toValue: target,
        duration: slideMs,
        // Only a transform moves, so the slide can run on the native
        // thread and keep its frames while JS is busy.
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
    setLifted({ ...lifted, to });
  });

  const endRow = useStableCallback(() => {
    clearHold();
    pending.current = null;
    const current = lifted;
    if (current == null) {
      return;
    }
    setLifted(null);
    onDrop();
    const items = itemsOf(current.section);
    const next = moveItem(items, current.from, current.to);
    if (next !== items) {
      setSettling({ section: current.section, data: next });
    }
    void write(reorderItems(items, current.from, current.to)).finally(() =>
      setSettling(null),
    );
  });

  // The list keeps its own order while a drag is live; only transforms
  // move the rows. After a drop the written order takes over.
  const displaySections = React.useMemo(() => {
    if (settling == null) {
      return sections;
    }
    return sections.map((section) =>
      section.key === settling.section
        ? { ...section, data: settling.data }
        : section,
    );
  }, [sections, settling]);

  // Where each row sits while the finger is down: the sequence the drop
  // would write. It drives the corners and the divider, not the data
  // order.
  const previewIndex = React.useMemo(() => {
    if (lifted == null) {
      return null;
    }
    const section = sections.find((item) => item.key === lifted.section);
    if (section == null) {
      return null;
    }
    const order = moveItem(section.data, lifted.from, lifted.to);
    return new Map(order.map((item, index) => [item.uri, index]));
  }, [sections, lifted]);

  // The transforms go back to zero in the same commit that reorders
  // the data, so the drop has no frame of its own.
  React.useLayoutEffect(() => {
    if (settling != null) {
      resetShifts();
    }
  }, [settling, resetShifts]);

  return {
    lifted,
    ghostY,
    previewIndex,
    displaySections,
    registerRow,
    shiftOf,
    holdRow,
    pickupRow,
    moveRow,
    endRow,
  };
}
