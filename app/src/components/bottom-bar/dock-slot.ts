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
 * The capture dock, handed to a screen by its route. A route may import
 * a feature. A screen may not, so the route passes the dock in (ADR
 * 0039). A screen that is not the Lists tab never calls it.
 */
export type DockSlot = (slot: CaptureSlot) => React.ReactNode;

/** What a screen tells the journal dock: the day it writes to. */
export type JournalSlot = {
  /** The local day the screen shows, `YYYY-MM-DD`. */
  day: string;
  /** Runs when a send starts, so the page can follow the new block. */
  onSend?: () => void;
};

/**
 * The journal dock, handed to the journal screen by its route. It is a
 * second slot shape because it needs no targets, no due day and no task
 * vocabulary. The route composes it, the screen calls it with the day
 * it shows, and the result goes in the bar's `action`.
 */
export type JournalDockSlot = (slot: JournalSlot) => React.ReactNode;
