import { readJson, writeJson } from "./json-store";

/**
 * Alert groups the operator has cleared, keyed by task uri and alarm
 * minute. A group outlives the app process, so a rebuild after a
 * restart cannot ring it again.
 */
export type AckedGroups = Record<string, number>;

/** One group: every ring a task makes from one alarm minute. */
export type AckTarget = { uri: string; base: number };

/** The longest an escalation runs, plus a margin for a late rebuild. */
export const ACK_TTL_MS = 20 * 60_000;

const FILE_NAME = "monkey-tasks-acked-alerts.json";
const WEB_KEY = "monkey-tasks.acked-alerts";

export function ackKey(uri: string, base: number): string {
  return `${uri}|${base}`;
}

export function isAcked(
  acked: AckedGroups,
  uri: string,
  base: number,
): boolean {
  return acked[ackKey(uri, base)] != null;
}

/** Drop groups whose last ring has surely passed. */
export function pruneAcked(acked: AckedGroups, now: number): AckedGroups {
  const kept: AckedGroups = {};
  for (const [key, at] of Object.entries(acked)) {
    if (typeof at === "number" && now - at <= ACK_TTL_MS) {
      kept[key] = at;
    }
  }
  return kept;
}

export function withAcks(
  acked: AckedGroups,
  groups: readonly AckTarget[],
  now: number,
): AckedGroups {
  let next = acked;
  for (const group of groups) {
    const key = ackKey(group.uri, group.base);
    if (next[key] == null) {
      if (next === acked) {
        next = { ...acked };
      }
      next[key] = now;
    }
  }
  return next;
}

function parseAcked(value: unknown): AckedGroups {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const next: AckedGroups = {};
  for (const [key, at] of Object.entries(value)) {
    if (typeof at === "number" && Number.isFinite(at)) {
      next[key] = at;
    }
  }
  return next;
}

function readRaw(): AckedGroups {
  return parseAcked(readJson(FILE_NAME, WEB_KEY));
}

function writeRaw(next: AckedGroups): void {
  // The group just is not remembered past this process when this fails.
  writeJson(FILE_NAME, WEB_KEY, next);
}

export function loadAcked(now: number = Date.now()): AckedGroups {
  const raw = readRaw();
  const next = pruneAcked(raw, now);
  if (Object.keys(next).length !== Object.keys(raw).length) {
    writeRaw(next);
  }
  return next;
}

export function recordAcks(
  groups: readonly AckTarget[],
  now: number = Date.now(),
): void {
  if (groups.length === 0) {
    return;
  }
  writeRaw(withAcks(loadAcked(now), groups, now));
}
