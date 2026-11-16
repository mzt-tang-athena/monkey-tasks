import type { IconName } from "@/components/ui/icon";
import { ruleWords } from "@/lib/recurrence";
import type { TaskEdit } from "@/types/task";
import { clockOf, whenWords } from "./lib/when";

export type PropertyKey = "due" | "repeat" | "alerts" | "note";

/**
 * One property the sheet shows as a tile when it has a value, and as a
 * chip in the add strip when it has none. A property that holds many
 * values keeps its chip even when set. The order of `PROPERTIES` is the
 * order on screen. Reference (ticket 0091) joins as one more entry.
 */
export type Property = {
  key: PropertyKey;
  /** The tile's small label. */
  title: string;
  /** The chip's words. */
  chip: string;
  icon: IconName;
  isSet: (draft: TaskEdit) => boolean;
  /** The chip stays in the strip when the property is set. */
  many: boolean;
  /** The tile takes the full row. */
  wide: boolean;
  /** The tile's value in plain words. */
  words: (draft: TaskEdit, today: Date) => string;
  /** The change the tile's clear button makes, or null for no button. */
  clear: (draft: TaskEdit) => Partial<TaskEdit> | null;
  /** Accessible names: the tile, its clear button, the chip. */
  names: { open: string; clear: string; add: string };
};

/** The alerts in words: "at due" for a timed due, then each reminder. */
export function alertWords(draft: TaskEdit, today: Date): string[] {
  const reminders = [...draft.reminders]
    .sort()
    .map((at) => whenWords(at, today));
  return clockOf(draft.due) == null ? reminders : ["At due", ...reminders];
}

/** The first two lines of a note that hold text. */
export function noteLines(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, 2)
    .join("\n");
}

/** The note as the editor shows it: no blank lines around it. */
export function noteText(body: string): string {
  return body.replace(/^(\r?\n)+/, "").trimEnd();
}

/** The body a note's text writes: one blank line under the fence. */
export function bodyOf(text: string): string {
  const kept = noteText(text);
  return kept === "" ? "" : `\n${kept}\n`;
}

export const PROPERTIES: readonly Property[] = [
  {
    key: "due",
    title: "Due",
    chip: "Date",
    icon: "calendar-mini",
    isSet: (draft) => draft.due != null,
    many: false,
    wide: false,
    words: (draft, today) => (draft.due == null ? "" : whenWords(draft.due, today)),
    clear: () => ({ due: null }),
    names: { open: "change due date", clear: "clear due date", add: "add due date" },
  },
  {
    key: "repeat",
    title: "Repeat",
    chip: "Repeat",
    icon: "repeat",
    isSet: (draft) => draft.recurrence != null,
    many: false,
    wide: false,
    words: (draft) =>
      draft.recurrence == null
        ? ""
        : (ruleWords(draft.recurrence, draft.due) ?? "Custom repeat"),
    clear: () => ({ recurrence: null }),
    names: { open: "change repeat", clear: "clear repeat", add: "add repeat" },
  },
  {
    key: "alerts",
    title: "Alerts",
    chip: "Reminder",
    icon: "bell",
    isSet: (draft) => draft.reminders.length > 0 || clockOf(draft.due) != null,
    many: true,
    wide: false,
    words: (draft, today) => {
      const lines = alertWords(draft, today);
      return lines.length <= 2
        ? lines.join(", ")
        : `${lines[0]} and ${lines.length - 1} more`;
    },
    // A timed due rings by itself. Only the reminders clear.
    clear: (draft) => (draft.reminders.length > 0 ? { reminders: [] } : null),
    names: { open: "change alerts", clear: "clear reminders", add: "add reminder" },
  },
  {
    key: "note",
    title: "Note",
    chip: "Note",
    icon: "note",
    isSet: (draft) => draft.body.trim() !== "",
    many: false,
    wide: true,
    words: (draft) => noteLines(draft.body),
    // A note clears by editing it, never by one stray tap.
    clear: () => null,
    names: { open: "edit note", clear: "", add: "add note" },
  },
];
