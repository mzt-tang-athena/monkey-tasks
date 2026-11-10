import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { taskRowFace } from "@/components/task-row-face";
import { Overlay } from "@/components/ui/overlay-host";
import {
  cardPosition,
  slotForY,
  slotTops,
  type RowSpan,
} from "@/lib/motion/drag-math";
import { holds, motion } from "@/lib/motion/tokens";
import { colors, radius, shadows, touchTarget } from "@/theme/tokens";
import { createBridgeGuard, toJS } from "./internal/bridge";
import {
  DraggingContext,
  SessionContext,
  useSessionContext,
} from "./internal/contexts";
import {
  send,
  useSession,
  type Session,
  type SessionHandlers,
} from "./internal/session";
import { abandonSource, settleSession } from "./internal/source";
import { withTouchAction } from "./internal/gesture";

const reduce = ReduceMotion.System;
const hairline = StyleSheet.hairlineWidth;

type RowSnapshot = { index: number; top: number; height: number };

type ItemEntry = {
  ref: AnimatedRef<View>;
  group: string;
  index: number;
};

type ReorderState = {
  items: SharedValue<Record<string, ItemEntry>>;
  snapshot: SharedValue<Record<string, RowSnapshot>>;
  shifts: SharedValue<Record<string, number>>;
  slots: SharedValue<Record<string, number>>;
};

export type ReorderEvent<P> = {
  payload: P;
  group: string;
  from: number;
  to: number;
};

type ReorderHandlers = SessionHandlers & {
  reorder: (
    generation: number,
    source: number,
    group: string,
    from: number,
    to: number,
  ) => void;
};

type ItemValue = {
  payload: unknown;
  group: string;
  index: number;
  disabled: boolean;
  ref: AnimatedRef<View>;
};

const StateContext = React.createContext<ReorderState | null>(null);
const ItemContext = React.createContext<ItemValue | null>(null);
const none: RowSpan[] = [];

function useStateContext(name: string): ReorderState {
  const state = React.useContext(StateContext);
  if (state === null) {
    throw new Error(`${name} must render inside its surface's Root.`);
  }
  return state;
}

function useItemContext(name: string): ItemValue {
  const item = React.useContext(ItemContext);
  if (item === null) {
    throw new Error(`${name} must render inside a Reorder.Item.`);
  }
  return item;
}

function clearShifts(
  generation: SharedValue<number>,
  shifts: SharedValue<Record<string, number>>,
  of: number,
): void {
  "worklet";
  if (generation.value === of) {
    shifts.set({});
  }
}

/** The owning row's snapshot: the mounted rows of its group, top down,
    with the index each carries. */
function snapshotOf(state: ReorderState, group: string) {
  "worklet";
  const entries = state.items.value;
  const list: (RowSnapshot & { key: string })[] = [];
  for (const key in entries) {
    const entry = entries[key];
    if (entry.group !== group) {
      continue;
    }
    const box = measure(entry.ref);
    if (box === null) {
      continue;
    }
    list.push({
      key,
      index: entry.index,
      top: box.pageY,
      height: box.height,
    });
  }
  for (let i = 1; i < list.length; i += 1) {
    const row = list[i];
    let at = i - 1;
    while (at >= 0 && list[at].index > row.index) {
      list[at + 1] = list[at];
      at -= 1;
    }
    list[at + 1] = row;
  }
  const snapshot: Record<string, RowSnapshot> = {};
  const keys: string[] = [];
  const rows: RowSpan[] = [];
  const slots: Record<string, number> = {};
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    snapshot[row.key] = { index: row.index, top: row.top, height: row.height };
    keys[i] = row.key;
    rows[i] = { top: row.top, height: row.height };
    slots[row.key] = row.index;
  }
  return { snapshot, keys, rows, slots };
}

/**
 * A reorderable list. A screen makes one at module scope,
 * `const ListReorder = createReorderSurface<TaskItem>()`, and passes
 * data and plain functions. The surface owns the hold, the lift, the
 * ghost, the slot math and the drop (ADR 0046). A row's shift and
 * corners read shared values, so a crossing renders nothing. A shift
 * counts only while the row's `index` equals the index it had at
 * pickup, so the commit that reorders the data carries zero shift.
 */
export function createReorderSurface<P>() {
  function Root({
    onReorder,
    renderGhost,
    children,
  }: {
    onReorder: (event: ReorderEvent<P>) => void;
    renderGhost: (payload: P) => React.ReactNode;
    children: React.ReactNode;
  }) {
    const [active, setActive] = React.useState<{ payload: P } | null>(null);
    const latest = React.useRef(onReorder);
    React.useLayoutEffect(() => {
      latest.current = onReorder;
    });
    const [guard] = React.useState(createBridgeGuard);
    const items = useSharedValue<Record<string, ItemEntry>>({});
    const snapshot = useSharedValue<Record<string, RowSnapshot>>({});
    const shifts = useSharedValue<Record<string, number>>({});
    const slots = useSharedValue<Record<string, number>>({});
    const [state] = React.useState<ReorderState>(() => ({
      items,
      snapshot,
      shifts,
      slots,
    }));
    // The clear waits for the commit's frame. The commit already draws
    // every moved row at zero through its index, so the drop has no
    // frame of its own (ADR 0032).
    const dropped = React.useRef(0);
    const [drops, setDrops] = React.useState(0);

    const session = useSession<ReorderHandlers>((self) => ({
      pickup(source, generation) {
        if (!guard.pickup(generation)) {
          return;
        }
        const payload = self.payloads.get(source) as P | undefined;
        if (payload !== undefined) {
          setActive({ payload });
        }
      },
      drop() {
        // The reorder's drop arrives through `reorder`.
      },
      cancel(generation) {
        if (!guard.settle(generation)) {
          return;
        }
        setActive(null);
        scheduleOnUI(clearShifts, self.ui.generation, shifts, generation);
      },
      reorder(generation, source, group, from, to) {
        if (!guard.settle(generation)) {
          return;
        }
        const payload = self.payloads.get(source) as P | undefined;
        setActive(null);
        if (payload !== undefined && from !== to) {
          latest.current({ payload, group, from, to });
        }
        dropped.current = generation;
        setDrops((count) => count + 1);
      },
    }));
    React.useEffect(() => () => void guard.close(), [guard]);
    React.useEffect(() => {
      if (drops > 0) {
        scheduleOnUI(clearShifts, session.ui.generation, shifts, dropped.current);
      }
    }, [drops, session, shifts]);

    return (
      <SessionContext.Provider value={session}>
        <DraggingContext.Provider value={active !== null}>
          <StateContext.Provider value={state}>
            {children}
            {active !== null ? (
              <Overlay layer="dragGhost">
                <Ghost session={session}>{renderGhost(active.payload)}</Ghost>
              </Overlay>
            ) : null}
          </StateContext.Provider>
        </DraggingContext.Provider>
      </SessionContext.Provider>
    );
  }

  function Item({
    payload,
    id,
    group,
    index,
    count,
    disabled = false,
    testID,
    children,
  }: {
    payload: P;
    id: string;
    group: string;
    index: number;
    count: number;
    disabled?: boolean;
    testID?: string;
    children: React.ReactNode;
  }) {
    const session = useSessionContext<ReorderHandlers>("ListReorder.Item");
    const state = useStateContext("ListReorder.Item");
    const ref = useAnimatedRef<View>();
    const [source] = React.useState(session.nextId);
    const item = React.useMemo<ItemValue>(
      () => ({ payload, group, index, disabled, ref }),
      [payload, group, index, disabled, ref],
    );
    React.useLayoutEffect(() => {
      session.payloads.set(source, payload);
    });
    React.useEffect(
      () => () => {
        session.payloads.delete(source);
        scheduleOnUI(abandonSource, session.ui, source, session.handlers.cancel);
      },
      [session, source],
    );
    React.useLayoutEffect(() => {
      state.items.modify((all) => {
        "worklet";
        all[id] = { ref, group, index };
        return all;
      });
    }, [state, id, ref, group, index]);
    React.useEffect(
      () => () => {
        state.items.modify((all) => {
          "worklet";
          delete all[id];
          return all;
        });
      },
      [state, id],
    );

    const { gesture, cue, shake } = useItemGesture({
      source,
      group,
      index,
      disabled,
      hold: "row",
      self: ref,
    });
    const look = useAnimatedStyle(() => {
      const snap = state.snapshot.value[id];
      const stamped = snap !== undefined && snap.index === index;
      const shift = stamped ? (state.shifts.value[id] ?? 0) : 0;
      const slot = stamped ? (state.slots.value[id] ?? index) : index;
      const position = cardPosition(slot, count);
      const machine = session.ui.machine.value;
      const mine =
        machine.owner === source &&
        machine.phase !== "idle" &&
        machine.phase !== "pending";
      return {
        opacity: mine ? 1 - 0.5 * session.ui.lift.value : 1,
        transform: [{ translateY: shift }, { translateX: shake.value }],
        borderTopLeftRadius: position === "first" || position === "only" ? radius : 0,
        borderTopRightRadius: position === "first" || position === "only" ? radius : 0,
        borderBottomLeftRadius: position === "last" || position === "only" ? radius : 0,
        borderBottomRightRadius: position === "last" || position === "only" ? radius : 0,
        borderTopWidth: position === "first" || position === "only" ? hairline : 0,
        borderBottomWidth: position === "last" || position === "only" ? hairline : 0,
      };
    });
    const divider = useAnimatedStyle(() => {
      const snap = state.snapshot.value[id];
      const stamped = snap !== undefined && snap.index === index;
      const slot = stamped ? (state.slots.value[id] ?? index) : index;
      const position = cardPosition(slot, count);
      return { opacity: position === "first" || position === "only" ? 0 : 1 };
    });
    const tint = useAnimatedStyle(() => ({ opacity: cue.value }));

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          ref={ref}
          collapsable={false}
          testID={testID}
          style={[styles.item, look]}
        >
          <Animated.View pointerEvents="none" style={[styles.tint, tint]} />
          <Animated.View
            pointerEvents="none"
            testID="card-divider"
            style={[styles.divider, divider]}
          />
          <ItemContext.Provider value={item}>{children}</ItemContext.Provider>
        </Animated.View>
      </GestureDetector>
    );
  }

  function Grip({ testID }: { testID?: string }) {
    const session = useSessionContext<ReorderHandlers>("ListReorder.Grip");
    const item = useItemContext("ListReorder.Grip");
    const [source] = React.useState(session.nextId);
    React.useLayoutEffect(() => {
      session.payloads.set(source, item.payload);
    });
    React.useEffect(
      () => () => {
        session.payloads.delete(source);
        scheduleOnUI(abandonSource, session.ui, source, session.handlers.cancel);
      },
      [session, source],
    );
    const { gesture, hidden: look } = useItemGesture({
      source,
      group: item.group,
      index: item.index,
      disabled: item.disabled,
      hold: "grip",
      self: item.ref,
      grip: true,
    });
    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="reorder handle"
          focusable={false}
          style={[styles.grip, look]}
        >
          <View style={styles.gripDots}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.gripRow}>
                <View style={styles.gripDot} />
                <View style={styles.gripDot} />
              </View>
            ))}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }

  function useItemGesture({
    source,
    group,
    index,
    disabled,
    hold,
    self,
    grip = false,
  }: {
    source: number;
    group: string;
    index: number;
    disabled: boolean;
    hold: "row" | "grip";
    self: AnimatedRef<View>;
    grip?: boolean;
  }) {
    const session = useSessionContext<ReorderHandlers>("ListReorder");
    const state = useStateContext("ListReorder");
    const { ui } = session;
    const cue = useSharedValue(0);
    const shake = useSharedValue(0);
    const from = useSharedValue(index);
    const to = useSharedValue(index);
    const keys = useSharedValue<string[]>([]);
    const rows = useSharedValue<RowSpan[]>(none);
    const { ms, touchAction } = holds[hold];

    const gesture = usePanGesture(
      withTouchAction(touchAction, {
        enabled: !disabled,
        minDistance: grip ? 0 : undefined,
        // The grip claims on the press. The web pan needs one timer tick
        // to do that, or the pager's pan takes the first sideways move.
        activateAfterLongPress: grip ? 1 : ms,
        onBegin: () => {
          "worklet";
          if (send(ui, { type: "begin", source }) === "flush") {
            ui.lift.set(0);
            ui.hover.set(null);
          }
          if (!grip) {
            cue.set(
              withDelay(
                motion.hold.cue,
                withTiming(1, {
                  duration: ms - motion.hold.cue,
                  reduceMotion: reduce,
                }),
              ),
            );
          }
        },
        onActivate: (event) => {
          "worklet";
          if (send(ui, { type: "activate", source }) !== "pickup") {
            return;
          }
          const generation = ui.generation.value + 1;
          ui.generation.set(generation);
          const box = measure(self);
          if (box !== null) {
            ui.grab.set({
              dx: event.absoluteX - box.pageX,
              dy: event.absoluteY - box.pageY,
              width: box.width,
            });
          }
          const taken = snapshotOf(state, group);
          state.snapshot.set(taken.snapshot);
          state.slots.set(taken.slots);
          state.shifts.set({});
          keys.set(taken.keys);
          rows.set(taken.rows);
          from.set(index);
          to.set(index);
          ui.x.set(event.absoluteX);
          ui.y.set(event.absoluteY);
          cue.set(1);
          ui.lift.set(
            withTiming(1, { duration: motion.ms.tap, reduceMotion: reduce }),
          );
          shake.set(
            withSequence(
              withTiming(-2.5, { duration: 40, reduceMotion: reduce }),
              withTiming(2.5, { duration: 50, reduceMotion: reduce }),
              withTiming(-1.5, { duration: 50, reduceMotion: reduce }),
              withTiming(0, { duration: 40, reduceMotion: reduce }),
            ),
          );
          toJS(session.handlers.pickup, source, generation);
        },
        onUpdate: (event) => {
          "worklet";
          const machine = ui.machine.value;
          if (machine.phase !== "dragging" || machine.owner !== source) {
            return;
          }
          ui.x.set(event.absoluteX);
          ui.y.set(event.absoluteY);
          const list = rows.value;
          if (list.length === 0) {
            return;
          }
          const slot = slotForY(event.absoluteY, list);
          const target = slot > from.value ? slot + 1 : slot;
          if (target === to.value) {
            return;
          }
          to.set(target);
          const order: number[] = [];
          for (let i = 0; i < list.length; i += 1) {
            if (i !== from.value) {
              order.push(i);
            }
          }
          order.splice(slot, 0, from.value);
          const tops = slotTops(order, list, 0);
          const nextShifts = {} as Record<string, number>;
          const nextSlots = {} as Record<string, number>;
          const names = keys.value;
          for (let position = 0; position < order.length; position += 1) {
            nextSlots[names[order[position]]] = position;
          }
          const slide = {
            duration: motion.ms.settle,
            easing: motion.easeOut,
            reduceMotion: reduce,
          };
          for (let i = 0; i < list.length; i += 1) {
            const value = withTiming(tops[i] - list[i].top, slide);
            (nextShifts as unknown as Record<string, unknown>)[names[i]] = value;
          }
          state.shifts.set(nextShifts);
          state.slots.set(nextSlots);
        },
        onDeactivate: (event) => {
          "worklet";
          const effect = send(ui, {
            type: "release",
            source,
            canceled: event.canceled,
          });
          if (effect === "drop") {
            toJS(
              session.handlers.reorder,
              ui.generation.value,
              source,
              group,
              from.value,
              to.value,
            );
            settleSession(ui);
          } else if (effect === "cancel") {
            toJS(session.handlers.cancel, ui.generation.value);
            settleSession(ui);
          }
        },
        onFinalize: () => {
          "worklet";
          if (send(ui, { type: "finalize", source }) === "cancel") {
            toJS(session.handlers.cancel, ui.generation.value);
            settleSession(ui);
          }
          cue.set(withTiming(0, { duration: motion.ms.tap, reduceMotion: reduce }));
        },
      }),
    );
    const hidden = useAnimatedStyle(() => {
      const machine = ui.machine.value;
      const mine =
        machine.owner === source &&
        machine.phase !== "idle" &&
        machine.phase !== "pending";
      return { opacity: mine ? 0 : 1 };
    });
    return { gesture, cue, shake, hidden };
  }

  /** Whether a row is held or dragged. A pager under the same Root
      reads it to keep its page while a row owns the finger. */
  function useDragging(): boolean {
    return React.useContext(DraggingContext);
  }

  return { Root, Item, Grip, useDragging };
}

/** The ghost under the finger. It renders in the overlay, outside the
    screen's providers, so it takes the session as a prop. */
function Ghost({ session, children }: { session: Session; children: React.ReactNode }) {
  const { x, y, grab } = session.ui;
  const place = useAnimatedStyle(() => ({
    width: grab.value.width,
    transform: [
      { translateX: x.value - grab.value.dx },
      { translateY: y.value - grab.value.dy },
      { scale: 1.03 },
    ],
  }));
  return (
    <Animated.View testID="drag-ghost" pointerEvents="none" style={[styles.ghost, place]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderLeftWidth: hairline,
    borderRightWidth: hairline,
    borderColor: colors.hairline,
  },
  tint: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.accentSoft,
  },
  divider: {
    position: "absolute",
    left: taskRowFace.textInset,
    right: 0,
    top: 0,
    height: hairline,
    backgroundColor: colors.hairline,
  },
  ghost: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.hairline,
    borderRadius: radius,
    ...shadows.lifted,
  },
  grip: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  gripDots: {
    gap: 3,
  },
  gripRow: {
    flexDirection: "row",
    gap: 4,
  },
  gripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.inkFaint,
  },
});
