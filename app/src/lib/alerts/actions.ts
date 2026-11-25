import { RESCHEDULE_CHOICES, type RescheduleChoice } from "./choices";

/**
 * What a button on a reminder can ask for. A button carries no data of
 * its own, so the choice is read back from the button's identifier.
 */
export type AlertAction =
  | { kind: "done" }
  | { kind: "reschedule"; target: string };

export const DONE_BUTTON = "done";

/** The action a button asks for, or null for a button this build lacks. */
export function buttonAction(
  button: string,
  now: Date,
  choices: readonly RescheduleChoice[] = RESCHEDULE_CHOICES,
): AlertAction | null {
  if (button === DONE_BUTTON) {
    return { kind: "done" };
  }
  const choice = choices.find((entry) => entry.id === button);
  return choice == null
    ? null
    : { kind: "reschedule", target: choice.target(now) };
}

/** A short word for the failure notice, for example "Done". */
export function actionLabel(action: AlertAction): string {
  return action.kind === "done" ? "Done" : "Reschedule";
}
