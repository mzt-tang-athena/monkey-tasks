import type { AlertWeight } from "@monkey-tasks/schemas";
import type { ButtonSet } from "./choices";

export type AlertRing = {
  /** Deterministic, so a rebuild replaces this ring instead of adding one. */
  id: string;
  /** The task note the ring belongs to. */
  uri: string;
  /** The alarm minute in epoch ms, as `alarmTimes` returns it. */
  base: number;
  weight: AlertWeight;
  /** Which buttons the ring carries. */
  buttons: ButtonSet;
  /** When the ring sounds, in epoch ms. */
  when: number;
  title: string;
  body: string;
};

/** The same task minute always makes the same id. */
export function alertRingId(uri: string, base: number): string {
  return `alert:${encodeURIComponent(uri)}:${base}`;
}

export function alertRing(input: {
  uri: string;
  base: number;
  weight: AlertWeight;
  buttons?: ButtonSet;
  title: string;
  body: string;
}): AlertRing {
  return {
    id: alertRingId(input.uri, input.base),
    uri: input.uri,
    base: input.base,
    weight: input.weight,
    // The diagnostics screen's test ring keeps the plain shape.
    buttons: input.buttons ?? "full",
    when: input.base,
    title: input.title,
    body: input.body,
  };
}
