import type { AlertAction } from "./actions";
import { readJson, writeJson } from "./json-store";

/**
 * Button presses whose vault write failed. A press from a killed app has
 * no screen to show the failure on, so it is kept here. The app lists it
 * when it opens, and a notification shows it until then.
 */
export type ActionFailure = {
  id: string;
  uri: string;
  name: string;
  action: AlertAction;
  message: string;
  at: number;
};

const FILE_NAME = "monkey-tasks-action-failures.json";
const WEB_KEY = "monkey-tasks.action-failures";

export function failureId(uri: string, action: AlertAction): string {
  return `${uri}|${action.kind}`;
}

function isFailure(value: unknown): value is ActionFailure {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<ActionFailure>;
  const action = entry.action;
  return (
    typeof entry.id === "string" &&
    typeof entry.uri === "string" &&
    typeof entry.name === "string" &&
    typeof entry.message === "string" &&
    typeof entry.at === "number" &&
    action != null &&
    (action.kind === "done" ||
      action.kind === "drop" ||
      (action.kind === "reschedule" && typeof action.target === "string"))
  );
}

const listeners = new Set<() => void>();

/** Called after a failure is kept or cleared in this process. */
export function onActionFailures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function loadActionFailures(): ActionFailure[] {
  const raw = readJson(FILE_NAME, WEB_KEY);
  return Array.isArray(raw) ? raw.filter(isFailure) : [];
}

/** One failure per task and action: a later one replaces it. */
export function recordActionFailure(failure: ActionFailure): boolean {
  const others = loadActionFailures().filter(
    (entry) =>
      entry.id !== failure.id &&
      !(
        entry.uri === failure.uri &&
        entry.action.kind === failure.action.kind
      ),
  );
  const kept = writeJson(FILE_NAME, WEB_KEY, [...others, failure]);
  changed();
  return kept;
}

/**
 * Drop one task's records for one action, and name them. The app
 * itself may have done what a press could not, and a stale line would
 * then say otherwise.
 */
export function clearActionFailuresFor(
  uri: string,
  kind: AlertAction["kind"],
): string[] {
  const all = loadActionFailures();
  const gone = all.filter(
    (entry) => entry.uri === uri && entry.action.kind === kind,
  );
  if (gone.length === 0) {
    return [];
  }
  const kept = new Set(gone);
  writeJson(
    FILE_NAME,
    WEB_KEY,
    all.filter((entry) => !kept.has(entry)),
  );
  changed();
  return gone.map((entry) => entry.id);
}

export function clearActionFailure(id: string): void {
  const all = loadActionFailures();
  const rest = all.filter((entry) => entry.id !== id);
  if (rest.length !== all.length) {
    writeJson(FILE_NAME, WEB_KEY, rest);
    changed();
  }
}
