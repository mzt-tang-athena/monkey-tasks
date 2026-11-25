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

export const RESCHEDULE_CHOICES: readonly RescheduleChoice[] = [
  {
    id: "probe",
    title: "Probe",
    target: (now) => {
      const at = new Date(now.getTime() + 2 * 60 * 60_000);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
    },
  },
];
