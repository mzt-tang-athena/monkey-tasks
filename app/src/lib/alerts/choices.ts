/**
 * The Reschedule buttons on a reminder: each moves the task to the
 * moment `target` returns, a stored datetime. Android shows at most
 * three buttons on a notification, and Done takes one.
 */
export type RescheduleChoice = {
  /** The button's identifier. */
  id: string;
  title: string;
  target(now: Date): string;
};

export const RESCHEDULE_CHOICES: readonly RescheduleChoice[] = [];
