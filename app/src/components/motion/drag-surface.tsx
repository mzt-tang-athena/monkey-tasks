import * as React from "react";
import { StyleSheet, type StyleProp, type View, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedRef,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Overlay } from "@/components/ui/overlay-host";
import type { Hit } from "@/lib/motion/drag-math";
import { motion, type HoldKind } from "@/lib/motion/tokens";
import { colors, shadows } from "@/theme/tokens";
import { createBridgeGuard } from "./internal/bridge";
import {
  ClipContext,
  DraggingContext,
  SessionContext,
  useSessionContext,
} from "./internal/contexts";
import {
  useRegistry,
  useSession,
  type Session,
  type ZoneEntry,
} from "./internal/session";
import { Source as EngineSource } from "./internal/source";

/**
 * A drag from sources to zones. A screen makes one at module scope,
 * `const Drag = createDragSurface<Task, Slot>()`, and passes data and
 * plain functions. The surface owns the gesture, the look, the ghost,
 * the hit test and every crossing to JS (ADR 0046).
 */
export function createDragSurface<P, T>() {
  function Root({
    onDrop,
    renderGhost,
    children,
  }: {
    onDrop: (payload: P, target: T) => void;
    renderGhost: (payload: P) => React.ReactNode;
    children: React.ReactNode;
  }) {
    const [active, setActive] = React.useState<{ payload: P } | null>(null);
    const latest = React.useRef(onDrop);
    React.useLayoutEffect(() => {
      latest.current = onDrop;
    });
    const [guard] = React.useState(createBridgeGuard);
    const picked = React.useRef(-1);
    const session = useSession((self) => ({
      pickup(source, generation) {
        if (!guard.pickup(generation)) {
          return;
        }
        picked.current = source;
        setActive({ payload: self.payloads.get(source) as P });
      },
      drop(generation, hit) {
        if (!guard.settle(generation)) {
          return;
        }
        const payload = self.payloads.get(picked.current) as P | undefined;
        setActive(null);
        const target = targetOf(self, hit);
        if (payload !== undefined && target !== undefined) {
          latest.current(payload, target as T);
        }
      },
      cancel(generation) {
        if (guard.settle(generation)) {
          setActive(null);
        }
      },
    }));
    React.useEffect(() => () => void guard.close(), [guard]);

    return (
      <SessionContext.Provider value={session}>
        <DraggingContext.Provider value={active !== null}>
          {children}
          {active !== null ? (
            <Overlay layer="dragGhost">
              <Ghost session={session}>{renderGhost(active.payload)}</Ghost>
            </Overlay>
          ) : null}
        </DraggingContext.Provider>
      </SessionContext.Provider>
    );
  }

  function Source(props: {
    payload: P;
    hold: HoldKind;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    children: React.ReactNode;
  }) {
    return <EngineSource {...props} />;
  }

  function Zone({
    target,
    style,
    testID,
    children,
  }: {
    target: T;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    children?: React.ReactNode;
  }) {
    const { id, ref, hover } = useZone(target, null);
    const tint = useAnimatedStyle(() => ({
      opacity: withTiming(hover.value?.id === id ? 1 : 0, {
        duration: motion.ms.tap,
        reduceMotion: ReduceMotion.System,
      }),
    }));
    return (
      <Animated.View ref={ref} collapsable={false} testID={testID} style={style}>
        <Animated.View pointerEvents="none" style={[styles.fill, styles.hover, tint]} />
        {children}
      </Animated.View>
    );
  }

  function Grid({
    columns,
    rows,
    cells,
    style,
    testID,
    children,
  }: {
    columns: number;
    rows: number;
    cells: readonly (T | null)[];
    style?: StyleProp<ViewStyle>;
    testID?: string;
    children?: React.ReactNode;
  }) {
    const shape = React.useMemo(
      () => ({ columns, rows, cells: cells.map((cell, i) => (cell === null ? null : i)) }),
      [columns, rows, cells],
    );
    const { id, ref, hover } = useZone(cells, shape);
    const box = useAnimatedStyle(() => {
      const hit = hover.value;
      if (hit === null || hit.id !== id) {
        return { opacity: 0 };
      }
      const column = hit.cell % columns;
      const row = Math.floor(hit.cell / columns);
      return {
        opacity: 1,
        left: `${(column * 100) / columns}%`,
        top: `${(row * 100) / rows}%`,
        width: `${100 / columns}%`,
        height: `${100 / rows}%`,
      };
    });
    return (
      <Animated.View ref={ref} collapsable={false} testID={testID} style={style}>
        <Animated.View pointerEvents="none" style={[styles.cell, styles.hover, box]} />
        {children}
      </Animated.View>
    );
  }

  function useDragging(): boolean {
    return React.useContext(DraggingContext);
  }

  return { Root, Source, Zone, Grid, useDragging };
}

/** A zone joins the session's registry for as long as it is mounted. */
function useZone(target: unknown, grid: ZoneEntry["grid"]) {
  const session = useSessionContext("Zone");
  const clip = React.useContext(ClipContext);
  const [id] = React.useState(session.nextId);
  const ref = useAnimatedRef<View>();
  React.useLayoutEffect(() => {
    session.targets.set(id, target);
  });
  React.useEffect(() => () => void session.targets.delete(id), [session, id]);
  const entry = React.useMemo<ZoneEntry>(() => ({ ref, clip, grid }), [ref, clip, grid]);
  useRegistry(session.ui.zones, id, entry);
  return { id, ref, hover: session.ui.hover };
}

function targetOf(session: Session, hit: Hit | null): unknown {
  if (hit === null) {
    return undefined;
  }
  const target = session.targets.get(hit.id);
  if (hit.cell === -1) {
    return target;
  }
  return (target as readonly unknown[] | undefined)?.[hit.cell] ?? undefined;
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
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cell: {
    position: "absolute",
  },
  hover: {
    backgroundColor: colors.accentSoft,
  },
  ghost: {
    position: "absolute",
    top: 0,
    left: 0,
    ...shadows.lifted,
  },
});
