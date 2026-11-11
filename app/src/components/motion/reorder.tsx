import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { taskRowFace } from "@/components/task-row-face";
import { Overlay } from "@/components/ui/overlay-host";
import {
  cardPosition,
  dropSpan,
  slotForY,
  slotIndexes,
  slotTops,
  stepSpan,
  type RowSpan,
} from "@/lib/motion/drag-math";
import { holds, motion } from "@/lib/motion/tokens";
import { colors, radius, shadows, touchTarget } from "@/theme/tokens";
import { createBridgeGuard, toJS } from "./internal/bridge";
import { useArrowKeys } from "./internal/keys";
import {
  DraggingContext,
  SessionContext,
  useSessionContext,
} from "./internal/contexts";
import { usePressCancel } from "./internal/press-cancel";
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
  id: string;
  group: string;
  index: number;
  count: number;
  disabled: boolean;
  ref: AnimatedRef<View>;
  /** The row's one drag source. Its grip picks the row up by it. */
  source: number;
  /** Move the row to the place a drop writes, by its data indexes. */
  move: (from: number, to: number) => void;
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
    with the index each carries and its place by mount order. */
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
  const indexes: number[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    snapshot[row.key] = { index: row.index, top: row.top, height: row.height };
    keys[i] = row.key;
    rows[i] = { top: row.top, height: row.height };
    slots[row.key] = row.index;
    indexes[i] = row.index;
  }
  return { snapshot, keys, rows, slots, indexes };
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
  type Move = (payload: P, group: string, from: number, to: number) => void;
  const MoveContext = React.createContext<Move | null>(null);

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
    // A step from the grip's screen reader actions or arrow keys takes
    // the same event a drop writes, with no pickup to settle.
    const move = React.useCallback<Move>(
      (payload, group, from, to) => {
        latest.current({ payload, group, from, to });
      },
      [],
    );
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
    const pressCancel = usePressCancel();

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
    }), pressCancel);
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
            <MoveContext.Provider value={move}>
              {children}
              {active !== null ? (
                <Overlay layer="dragGhost">
                  <Ghost session={session}>{renderGhost(active.payload)}</Ghost>
                </Overlay>
              ) : null}
            </MoveContext.Provider>
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
    const move = React.useContext(MoveContext);
    if (move === null) {
      throw new Error("ListReorder.Item must render inside its surface's Root.");
    }
    const ref = useAnimatedRef<View>();
    const [source] = React.useState(session.nextId);
    const item = React.useMemo<ItemValue>(
      () => ({
        payload,
        id,
        group,
        index,
        count,
        disabled,
        ref,
        source,
        move: (from, to) => move(payload, group, from, to),
      }),
      [payload, id, group, index, count, disabled, ref, source, move],
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
        transform: [{ translateY: shift }],
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

    return (
      <Animated.View
        ref={ref}
        collapsable={false}
        testID={testID}
        style={[styles.item, look]}
      >
        <Animated.View
          pointerEvents="none"
          testID="card-divider"
          style={[styles.divider, divider]}
        />
        <ItemContext.Provider value={item}>{children}</ItemContext.Provider>
      </Animated.View>
    );
  }

  function Grip({ testID, label }: { testID?: string; label: string }) {
    const item = useItemContext("ListReorder.Grip");
    const gripRef = React.useRef<React.ComponentRef<typeof Animated.View>>(null);
    const { gesture, hidden: look } = useGripGesture({
      source: item.source,
      id: item.id,
      group: item.group,
      disabled: item.disabled,
      self: item.ref,
    });
    // A step is one place in My order, and it writes through the same
    // data-index event a drop sends.
    const { index, count, move } = item;
    const step = React.useCallback(
      (direction: 1 | -1) => {
        const span = stepSpan(index, count, direction);
        if (span !== null) {
          move(span.from, span.to);
        }
      },
      [index, count, move],
    );
    // The arrow key points up or down the screen, so the up arrow is a
    // step to the earlier place.
    const arrow = React.useCallback(
      (pointing: 1 | -1) => step(pointing === 1 ? -1 : 1),
      [step],
    );
    useArrowKeys(gripRef, arrow);
    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          ref={gripRef}
          testID={testID}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 1, max: item.count, now: item.index + 1 }}
          aria-valuemin={1}
          aria-valuemax={item.count}
          aria-valuenow={item.index + 1}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            step(event.nativeEvent.actionName === "increment" ? 1 : -1);
          }}
          tabIndex={0}
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

  function useGripGesture({
    source,
    id,
    group,
    disabled,
    self,
  }: {
    source: number;
    id: string;
    group: string;
    disabled: boolean;
    self: AnimatedRef<View>;
  }) {
    const session = useSessionContext<ReorderHandlers>("ListReorder");
    const state = useStateContext("ListReorder");
    const { ui, pressCancel } = session;
    // The picked row's mount position, and the boundary it lands on.
    // The group's data indexes stay on the other side of the bridge.
    const from = useSharedValue(0);
    const to = useSharedValue(0);
    const keys = useSharedValue<string[]>([]);
    const rows = useSharedValue<RowSpan[]>(none);
    const indexes = useSharedValue<number[]>([]);
    const { touchAction } = holds.grip;

    const gesture = usePanGesture(
      withTouchAction(touchAction, {
        enabled: !disabled,
        minDistance: 0,
        // The grip claims on the press. The web pan needs one timer tick
        // to do that, or the pager's pan takes the first sideways move.
        activateAfterLongPress: 1,
        onBegin: () => {
          "worklet";
          if (send(ui, { type: "begin", source }) === "flush") {
            ui.lift.set(0);
            ui.hover.set(null);
          }
        },
        onActivate: (event) => {
          "worklet";
          if (send(ui, { type: "activate", source }) !== "pickup") {
            return;
          }
          toJS(pressCancel.arm);
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
          const at = taken.keys.indexOf(id);
          if (at === -1) {
            // The row has no laid-out box, so its group has no order to
            // move it in. Let go before anything lifts.
            toJS(session.handlers.cancel, generation);
            settleSession(ui);
            return;
          }
          state.snapshot.set(taken.snapshot);
          state.slots.set(taken.slots);
          state.shifts.set({});
          keys.set(taken.keys);
          rows.set(taken.rows);
          indexes.set(taken.indexes);
          from.set(at);
          to.set(at);
          ui.x.set(event.absoluteX);
          ui.y.set(event.absoluteY);
          ui.lift.set(
            withTiming(1, { duration: motion.ms.tap, reduceMotion: reduce }),
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
          const slotsAfter = slotIndexes(from.value, target, indexes.value);
          for (let position = 0; position < names.length; position += 1) {
            nextSlots[names[position]] = slotsAfter[position];
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
            const span = dropSpan(from.value, to.value, indexes.value);
            if (span === null) {
              toJS(session.handlers.cancel, ui.generation.value);
            } else {
              toJS(
                session.handlers.reorder,
                ui.generation.value,
                source,
                group,
                span.from,
                span.to,
              );
            }
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
    return { gesture, hidden };
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
