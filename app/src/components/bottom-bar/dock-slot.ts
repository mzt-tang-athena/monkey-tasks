import type * as React from "react";
import type { CaptureTarget } from "@/types/task";

/** What a screen tells the capture dock. */
export type CaptureSlot = {
  /** The lists the target pill cycles through. */
  targets: CaptureTarget[];
  /** The pill's first target. It follows the screen's own tab. */
  defaultTargetIndex: number;
  /** The due day a capture takes when its text names none, as `YYYY-MM-DD`. */
  dueDay?: string;
};

/**
 * The capture dock, handed to a screen by its route. The screen calls
 * it with its capture slot and puts the result in the bottom bar's
 * `action`. A route may import a feature. A screen may not, so the
 * route passes the dock in (ADR 0039).
 */
export type DockSlot = (slot: CaptureSlot) => React.ReactNode;
