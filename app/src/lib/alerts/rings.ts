import type { AlertWeight } from "@monkey-tasks/schemas";
import type { ButtonSet } from "./choices";

export type AlertRing = {
  /** Deterministic, so a rebuild replaces this ring instead of adding one. */
  id: string;
  /** The task note the ring belongs to. */
  uri: string;
  /** The alarm minute in epoch ms, as `alarmTimes` returns it. */
  base: number;
  /** Minutes after `base` this ring rings. */
  step: number;
  weight: AlertWeight;
  /** Which buttons the ring carries. */
  buttons: ButtonSet;
  /** `base` plus the step, in epoch ms. */
  when: number;
  title: string;
  body: string;
};

const MINUTE_MS = 60_000;

/** A harsh alert escalates; a quiet one rings once. */
export const ESCALATION_MINUTES: Record<AlertWeight, readonly number[]> = {
  harsh: [0, 1, 5, 15],
  quiet: [0],
};

/** The same task minute and step always make the same id. */
export function alertRingId(uri: string, base: number, step: number): string {
  return `alert:${encodeURIComponent(uri)}:${base}:${step}`;
}

export function alertRing(input: {
  uri: string;
  base: number;
  step: number;
  weight: AlertWeight;
  buttons?: ButtonSet;
  title: string;
  body: string;
}): AlertRing {
  return {
    id: alertRingId(input.uri, input.base, input.step),
    uri: input.uri,
    base: input.base,
    step: input.step,
    weight: input.weight,
    // The diagnostics screen's test ring keeps the plain shape.
    buttons: input.buttons ?? "full",
    when: input.base + input.step * MINUTE_MS,
    title: input.title,
    body: input.body,
  };
}
