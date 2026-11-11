import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { readBreadcrumbs, type Breadcrumb } from "./breadcrumbs";
import { appVersion, buildChannel } from "./build-info";

/**
 * The crash report on the phone. Every caught error appends one entry
 * to a file in the app's documents folder, never the vault. The file
 * holds readable text, so the operator can copy or share it without a
 * laptop and without a network.
 */
export type CrashKind = "js" | "render";

export type CrashReport = {
  message: string;
  stack?: string;
  /** Where the error was caught: the global handler or a boundary. */
  kind?: CrashKind;
  /** The screen label of a caught render error. */
  label?: string;
  /** React Native's fatal flag, for an uncaught JS error. */
  fatal?: boolean;
  /** Test seam. The report uses the current time when absent. */
  at?: Date;
};

export type CrashContext = {
  at: Date;
  version: string;
  channel: string;
  platform: string;
  breadcrumbs: readonly Breadcrumb[];
};

export const CRASH_LOG_FILE = "monkey-tasks-crash.log";
export const CRASH_LOG_OLD_FILE = "monkey-tasks-crash.old.log";
export const CRASH_LOG_MAX_BYTES = 200 * 1024;
export const CRASH_LOG_STACK_LINES = 30;
export const CRASH_LOG_MESSAGE_LIMIT = 2000;

const WEB_LOG_KEY = "monkey-tasks.crash-log";
const WEB_OLD_KEY = "monkey-tasks.crash-log.old";
const ENTRY_MARK = "=== crash ";

/** The UTF-8 size of a string, without a TextEncoder. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function clipBytes(text: string, max: number): string {
  if (utf8Bytes(text) <= max) {
    return text;
  }
  let bytes = 0;
  let kept = "";
  for (const char of text) {
    const size = utf8Bytes(char);
    if (bytes + size > max) {
      break;
    }
    bytes += size;
    kept += char;
  }
  return kept;
}

/**
 * One entry. The header carries the facts a reader needs to place
 * the crash; the stack is capped so one deep error cannot fill the
 * file.
 */
export function formatCrashEntry(
  report: CrashReport,
  context: CrashContext,
): string {
  const kind = report.kind ?? "js";
  const fatal = kind === "js" ? ` fatal=${report.fatal === false ? "no" : "yes"}` : "";
  const label = report.label == null ? "" : ` label=${oneLine(report.label)}`;
  const lines = [
    `${ENTRY_MARK}${context.at.toISOString()} app=${oneLine(context.version)} channel=${context.channel} platform=${context.platform} kind=${kind}${fatal}${label}`,
    `message: ${clip(oneLine(report.message), CRASH_LOG_MESSAGE_LIMIT)}`,
    "stack:",
  ];
  const frames = (report.stack ?? "")
    .split("\n")
    .slice(0, CRASH_LOG_STACK_LINES);
  if (frames.length === 0 || frames[0] === "") {
    lines.push("  (none)");
  } else {
    for (const frame of frames) {
      lines.push(`  ${frame}`);
    }
  }
  lines.push("breadcrumbs:");
  if (context.breadcrumbs.length === 0) {
    lines.push("  (none)");
  } else {
    for (const crumb of context.breadcrumbs) {
      const detail = crumb.detail == null ? "" : ` ${crumb.detail}`;
      lines.push(`  ${crumb.at} ${crumb.kind}${detail}`);
    }
  }
  return `${lines.join("\n")}\n\n`;
}

export type AppendPlan = {
  /** The entry, clipped if it is larger than the whole cap. */
  text: string;
  /** Whether the current file must move aside first. */
  rotate: boolean;
};

/** Decide whether one entry fits in the current file. */
export function planAppend(
  currentBytes: number,
  entry: string,
  max: number = CRASH_LOG_MAX_BYTES,
): AppendPlan {
  const text = clipBytes(entry, max);
  return {
    text,
    rotate: currentBytes > 0 && currentBytes + utf8Bytes(text) > max,
  };
}

function readNative(name: string): string {
  try {
    const file = new File(Paths.document, name);
    return file.exists ? file.textSync() : "";
  } catch {
    return "";
  }
}

function sizeNative(name: string): number {
  try {
    const file = new File(Paths.document, name);
    return file.exists ? file.size : 0;
  } catch {
    return 0;
  }
}

function writeNative(name: string, text: string, append: boolean): void {
  try {
    new File(Paths.document, name).writeSync(text, { append });
  } catch {
    // The report is best effort. A full disk cannot take the app down.
  }
}

function deleteNative(name: string): void {
  try {
    const file = new File(Paths.document, name);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // The file is already gone.
  }
}

function readWeb(key: string): string {
  try {
    return globalThis.localStorage?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeWeb(key: string, text: string): void {
  try {
    globalThis.localStorage?.setItem(key, text);
  } catch {
    // Storage is full or blocked. The report is best effort.
  }
}

function logBytes(): number {
  return Platform.OS === "web"
    ? utf8Bytes(readWeb(WEB_LOG_KEY))
    : sizeNative(CRASH_LOG_FILE);
}

function readLogText(): string {
  return Platform.OS === "web" ? readWeb(WEB_LOG_KEY) : readNative(CRASH_LOG_FILE);
}

function replaceLog(name: string, text: string, webKey: string): void {
  if (Platform.OS === "web") {
    writeWeb(webKey, text);
  } else {
    writeNative(name, text, false);
  }
}

function appendLog(text: string): void {
  if (Platform.OS === "web") {
    writeWeb(WEB_LOG_KEY, readWeb(WEB_LOG_KEY) + text);
  } else {
    writeNative(CRASH_LOG_FILE, text, true);
  }
}

/** The log as the diagnostics screen reads it. Empty when none exist. */
export function readCrashLog(): string {
  return readLogText();
}

/** The last entry, for a screen that shows one crash at a time. */
export function latestCrashEntry(text: string): string {
  const at = text.lastIndexOf(`\n${ENTRY_MARK}`);
  if (at === -1) {
    return text.startsWith(ENTRY_MARK) ? text.trimEnd() : "";
  }
  return text.slice(at + 1).trimEnd();
}

/** How many entries the file holds. */
export function crashCount(text: string): number {
  let count = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith(ENTRY_MARK)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Append one report. Synchronous on native, so the bytes land before
 * the process can die. A report that cannot be written is dropped,
 * never thrown.
 */
export function reportCrash(report: CrashReport): void {
  try {
    const entry = formatCrashEntry(report, {
      at: report.at ?? new Date(),
      version: appVersion(),
      channel: buildChannel(),
      platform: Platform.OS,
      breadcrumbs: readBreadcrumbs(),
    });
    const plan = planAppend(logBytes(), entry);
    if (plan.rotate) {
      replaceLog(CRASH_LOG_OLD_FILE, readLogText(), WEB_OLD_KEY);
      replaceLog(CRASH_LOG_FILE, plan.text, WEB_LOG_KEY);
    } else {
      appendLog(plan.text);
    }
  } catch {
    // The crash report never takes the app down with it.
  }
}

/** Remove both files. The test hooks and the tests use it. */
export function clearCrashLog(): void {
  if (Platform.OS === "web") {
    for (const key of [WEB_LOG_KEY, WEB_OLD_KEY]) {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // Nothing to remove.
      }
    }
    return;
  }
  deleteNative(CRASH_LOG_FILE);
  deleteNative(CRASH_LOG_OLD_FILE);
}
