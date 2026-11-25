import { readJson, writeJson } from "./json-store";

/**
 * Button presses the app has already acted on. Android can hand one
 * press to the background task and to the app's own listener, and can
 * replay a press when the app opens later. A press acts once.
 */
const FILE_NAME = "monkey-tasks-handled-actions.json";
const WEB_KEY = "monkey-tasks.handled-actions";

const KEEP_MS = 6 * 60 * 60_000;

type Handled = Record<string, number>;

function load(now: number): Handled {
  const raw = readJson(FILE_NAME, WEB_KEY);
  const kept: Handled = {};
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, at] of Object.entries(raw)) {
      if (typeof at === "number" && now - at <= KEEP_MS) {
        kept[key] = at;
      }
    }
  }
  return kept;
}

/** True the first time a press is claimed, false for every repeat. */
export function claimPress(key: string, now: number = Date.now()): boolean {
  const handled = load(now);
  if (handled[key] != null) {
    return false;
  }
  handled[key] = now;
  writeJson(FILE_NAME, WEB_KEY, handled);
  return true;
}

/**
 * Give a claim back, after the press it named did not land. A press
 * that failed is not done, so the same button must still act.
 */
export function releasePress(key: string, now: number = Date.now()): void {
  const handled = load(now);
  if (handled[key] == null) {
    return;
  }
  delete handled[key];
  writeJson(FILE_NAME, WEB_KEY, handled);
}
