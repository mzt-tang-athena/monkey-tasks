/**
 * One drag session's phases. Sources begin while the session is idle
 * or pending, and the first to activate owns the drag. Every pickup
 * ends in exactly one drop or cancel, and the session then settles
 * before the next pickup. A begin during the settle flushes it.
 */
export type DragPhase = "idle" | "pending" | "dragging" | "settling";

/** `owner` is the source that picked up, or -1. */
export type DragState = { phase: DragPhase; owner: number };

export type DragEvent =
  | { type: "begin"; source: number }
  | { type: "activate"; source: number }
  | { type: "release"; source: number; canceled: boolean }
  | { type: "finalize"; source: number }
  | { type: "settled" };

export type DragEffect = "none" | "pickup" | "drop" | "cancel" | "flush";

export const idle: DragState = { phase: "idle", owner: -1 };

export function step(
  state: DragState,
  event: DragEvent,
): { state: DragState; effect: DragEffect } {
  "worklet";
  const stay = { state, effect: "none" as DragEffect };
  switch (state.phase) {
    case "idle":
      if (event.type === "begin") {
        return { state: { phase: "pending", owner: -1 }, effect: "none" };
      }
      if (event.type === "activate") {
        return { state: { phase: "dragging", owner: event.source }, effect: "pickup" };
      }
      return stay;
    case "pending":
      if (event.type === "activate") {
        return { state: { phase: "dragging", owner: event.source }, effect: "pickup" };
      }
      if (event.type === "finalize") {
        return { state: { phase: "idle", owner: -1 }, effect: "none" };
      }
      return stay;
    case "dragging":
      if (event.type === "release" && event.source === state.owner) {
        return {
          state: { phase: "settling", owner: state.owner },
          effect: event.canceled ? "cancel" : "drop",
        };
      }
      if (event.type === "finalize" && event.source === state.owner) {
        return { state: { phase: "settling", owner: state.owner }, effect: "cancel" };
      }
      return stay;
    case "settling":
      if (event.type === "settled") {
        return { state: { phase: "idle", owner: -1 }, effect: "none" };
      }
      if (event.type === "begin") {
        return { state: { phase: "pending", owner: -1 }, effect: "flush" };
      }
      return stay;
  }
}
