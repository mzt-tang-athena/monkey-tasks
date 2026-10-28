import * as React from "react";
import type { TaskItem } from "@/types/task";
import { drag } from "@/theme/tokens";
import { pointerPickup } from "@/features/planner/components/drag";

/** A press waiting on a touch: where it started, when, and what it
    would become if the finger holds long enough. */
export type PendingDrag = {
  task: TaskItem;
  x: number;
  y: number;
  t: number;
  touch: boolean;
  kind?: "pill" | "row";
};

/**
 * While a drag or grab owns the pointer, the browser must keep its
 * hands off the pane scrolling: touch-action is read once at the
 * gesture's start and cannot change, but a non-passive touchmove
 * listener is read per event, so preventDefault wins mid-gesture.
 * Mounts once per drag root; the ref flips as gestures come alive.
 */
/**
 * The touch gate. Listens non-passively at a drag root, and owns the
 * touch pickup decision because touchmove runs before pointermove:
 * by the time the browser sees the move, the promotion is already
 * made and its scroll is prevented, so panes cannot steal the
 * pointer mid-gesture.
 *
 * Per touchmove: while a drag or grab holds the pointer, scrolling
 * is prevented outright. When a touch pickup has held long enough,
 * its first move promotes the drag right here and the event is
 * prevented. Movement before then cancels the pickup and releases
 * the gesture to the browser's scrolling.
 */
export function useTouchDragGate(
  ref: React.RefObject<HTMLElement | null>,
  opts: {
    busy: React.RefObject<boolean>;
    pending: React.RefObject<PendingDrag | null>;
    promote: (x: number, y: number) => void;
  },
) {
  const { busy, pending: pendingRef, promote } = opts;
  React.useEffect(() => {
    // Web-only: the gate works through DOM listeners, which native
    // views do not carry (the crash the phone caught).
    if (!pointerPickup) {
      return;
    }
    const node = ref.current;
    if (!node) {
      return;
    }
    const onMove = (e: TouchEvent) => {
      if (busy.current) {
        e.preventDefault();
        return;
      }
      const pending = pendingRef.current;
      const touch = e.changedTouches?.[0] ?? e.touches[0];
      if (pending && touch != null) {
        const travel =
          Math.abs(touch.pageX - pending.x) +
          Math.abs(touch.pageY - pending.y);
        const hold =
          pending.kind === "pill" ? drag.pillPickMs : drag.pickMs;
        const held = performance.now() - pending.t >= hold;
        if (held) {
          e.preventDefault();
          promote(touch.pageX, touch.pageY);
          return;
        }
        // Still holding: movement is a scroll. Let it through.
        if (travel > drag.threshold) {
          return;
        }
      }
    };
    node.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      node.removeEventListener("touchmove", onMove);
    };
  }, [ref, busy, pendingRef, promote]);
}
