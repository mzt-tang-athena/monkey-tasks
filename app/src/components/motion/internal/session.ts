import * as React from "react";
import type { View } from "react-native";
import {
  measure,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { idle, step, type DragEvent, type DragState } from "@/lib/motion/drag-machine";
import type { GridRect, Hit, Rect, ZoneRect } from "@/lib/motion/drag-math";
import type { PressCancel } from "./press-cancel";

/** A zone in the registry. A grid carries its cells, as indexes, with
    `null` for a cell that is no target. */
export type ZoneEntry = {
  ref: AnimatedRef<View>;
  clip: number;
  grid: { columns: number; rows: number; cells: readonly (number | null)[] } | null;
};

export type Grab = { dx: number; dy: number; width: number };

export type Rects = {
  generation: number;
  zones: ZoneRect[];
  grids: GridRect[];
  clips: Record<number, Rect>;
};

/** What the UI thread owns. Worklets capture this, and never the JS
    half, which holds payloads. */
export type SessionUI = {
  machine: SharedValue<DragState>;
  /** Counts pickups. Every crossing carries it. */
  generation: SharedValue<number>;
  /** The finger, in page coordinates. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** Where the finger took the owning source, from its top left, and
      the source's width. The ghost keeps both. */
  grab: SharedValue<Grab>;
  /** The owner's lifted look, 0 to 1. */
  lift: SharedValue<number>;
  hover: SharedValue<Hit | null>;
  zones: SharedValue<Record<number, ZoneEntry>>;
  clips: SharedValue<Record<number, AnimatedRef<View>>>;
  rects: SharedValue<Rects>;
};

/** The root's JS ends. Worklets reach them through the bridge. */
export type SessionHandlers = {
  pickup: (source: number, generation: number) => void;
  drop: (generation: number, hit: Hit | null) => void;
  cancel: (generation: number) => void;
};

export type Session = {
  ui: SessionUI;
  handlers: SessionHandlers;
  /** Swallows the click a pan activation leaves behind. */
  pressCancel: PressCancel;
  /** Payloads by source id and targets by zone id, refreshed in layout
      effects. A grid stores its whole cell list. */
  payloads: Map<number, unknown>;
  targets: Map<number, unknown>;
  nextId: () => number;
};

const noRects: Rects = { generation: 0, zones: [], grids: [], clips: {} };
const noGrab: Grab = { dx: 0, dy: 0, width: 0 };

/** One session per surface mount. `makeHandlers` builds the root's JS
    ends once, from the session they serve. A surface may add its own
    ends, so the return keeps their types. */
export function useSession<H extends SessionHandlers = SessionHandlers>(
  makeHandlers: (session: Session) => H,
  pressCancel: PressCancel,
): Session & { handlers: H } {
  const machine = useSharedValue<DragState>(idle);
  const generation = useSharedValue(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const grab = useSharedValue(noGrab);
  const lift = useSharedValue(0);
  const hover = useSharedValue<Hit | null>(null);
  const zones = useSharedValue<Record<number, ZoneEntry>>({});
  const clips = useSharedValue<Record<number, AnimatedRef<View>>>({});
  const rects = useSharedValue(noRects);
  const [session] = React.useState<Session>(() => {
    let next = 0;
    const made: Session = {
      ui: { machine, generation, x, y, grab, lift, hover, zones, clips, rects },
      handlers: { pickup() {}, drop() {}, cancel() {} },
      pressCancel,
      payloads: new Map(),
      targets: new Map(),
      nextId: () => ++next,
    };
    made.handlers = makeHandlers(made);
    return made;
  });
  return session as Session & { handlers: H };
}

/** Feeds the machine one event and returns its effect. */
export function send(ui: SessionUI, event: DragEvent) {
  "worklet";
  const next = step(ui.machine.value, event);
  ui.machine.set(next.state);
  return next.effect;
}

function pageRect(ref: AnimatedRef<View>): Rect | null {
  "worklet";
  const m = measure(ref);
  return m === null ? null : { x: m.pageX, y: m.pageY, width: m.width, height: m.height };
}

/** Measures every registered zone and scroller, for the pickup with
    this generation. Only `pageX` and `pageY` share space with the
    gesture's `absoluteX` and `absoluteY`. */
export function measureZones(ui: SessionUI, generation: number): void {
  "worklet";
  const clips: Record<number, Rect> = {};
  const clipRefs = ui.clips.value;
  for (const key in clipRefs) {
    const rect = pageRect(clipRefs[key]);
    if (rect !== null) {
      clips[Number(key)] = rect;
    }
  }
  const zones: ZoneRect[] = [];
  const grids: GridRect[] = [];
  const registry = ui.zones.value;
  for (const key in registry) {
    const entry = registry[key];
    const rect = pageRect(entry.ref);
    if (rect === null) {
      continue;
    }
    const zone = {
      id: Number(key),
      clip: entry.clip,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
    if (entry.grid === null) {
      zones.push(zone);
    } else {
      grids.push({
        id: zone.id,
        clip: zone.clip,
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
        columns: entry.grid.columns,
        rows: entry.grid.rows,
        cells: entry.grid.cells,
      });
    }
  }
  ui.rects.set({ generation, zones, grids, clips });
}

/** Adds a zone or a scroller to its registry for as long as it stays
    mounted, and keeps its entry current. */
export function useRegistry<E>(
  registry: SharedValue<Record<number, E>> | undefined,
  id: number,
  entry: E,
): void {
  React.useLayoutEffect(() => {
    registry?.modify((all) => {
      "worklet";
      all[id] = entry;
      return all;
    });
  }, [registry, id, entry]);
  React.useLayoutEffect(
    () => () => {
      registry?.modify((all) => {
        "worklet";
        delete all[id];
        return all;
      });
    },
    [registry, id],
  );
}
