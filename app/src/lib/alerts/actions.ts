import { RESCHEDULE_CHOICES, type RescheduleChoice } from "./choices";

/**
 * What a button on a reminder can ask for. A button carries no data of
 * its own, so the choice is read back from the button's identifier.
 * Snooze is no action: it opens the app on a sheet, and the sheet's
 * choice becomes a reschedule.
 */
export type AlertAction =
  | { kind: "done" }
  | { kind: "drop" }
  | { kind: "reschedule"; target: string };

export const DONE_BUTTON = "done";
export const DROP_BUTTON = "didnt";
export const SNOOZE_BUTTON = "snooze";

/**
 * The action a button asks for, or null for a button this build lacks
 * and for Snooze. The Later and Tomorrow ids stay readable, because a
 * reminder already in the tray still carries them.
 */
export function buttonAction(
  button: string,
  now: Date,
  choices: readonly RescheduleChoice[] = RESCHEDULE_CHOICES,
): AlertAction | null {
  if (button === DONE_BUTTON) {
    return { kind: "done" };
  }
  if (button === DROP_BUTTON) {
    return { kind: "drop" };
  }
  const choice = choices.find((entry) => entry.id === button);
  return choice == null
    ? null
    : { kind: "reschedule", target: choice.target(now) };
}

/** A short word for the failure notice, for example "Done". */
export function actionLabel(action: AlertAction): string {
  switch (action.kind) {
    case "done":
      return "Done";
    case "drop":
      return "Didn't do";
    case "reschedule":
      return "Snooze";
  }
}
