import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

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

/** The map with these groups acknowledged at `now`. */
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

function parseAcked(text: string | null | undefined): AckedGroups {
  if (text == null) {
    return {};
  }
  const parsed: unknown = JSON.parse(text);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const next: AckedGroups = {};
  for (const [key, at] of Object.entries(parsed)) {
    if (typeof at === "number" && Number.isFinite(at)) {
      next[key] = at;
    }
  }
  return next;
}

function readRaw(): AckedGroups {
  try {
    if (Platform.OS === "web") {
      return parseAcked(globalThis.localStorage?.getItem(WEB_KEY));
    }
    const file = new File(Paths.document, FILE_NAME);
    return file.exists ? parseAcked(file.textSync()) : {};
  } catch {
    return {};
  }
}

function writeRaw(next: AckedGroups): void {
  try {
    const text = JSON.stringify(next);
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(WEB_KEY, text);
      return;
    }
    new File(Paths.document, FILE_NAME).writeSync(text);
  } catch {
    // The group just is not remembered past this process.
  }
}

/** Every acknowledged group, pruned to the escalation window. */
export function loadAcked(now: number = Date.now()): AckedGroups {
  const raw = readRaw();
  const next = pruneAcked(raw, now);
  if (Object.keys(next).length !== Object.keys(raw).length) {
    writeRaw(next);
  }
  return next;
}

/** Remember these groups so no rebuild rings them again. */
export function recordAcks(
  groups: readonly AckTarget[],
  now: number = Date.now(),
): void {
  if (groups.length === 0) {
    return;
  }
  writeRaw(withAcks(loadAcked(now), groups, now));
}
