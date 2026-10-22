import * as chrono from "chrono-node";
import { formatLocal } from "../../lib/dates";

/**
 * Offline capture parsing: turn a typed line into task note properties.
 * No LLM. chrono-node finds dates and times; explicit "repeat <word>"
 * phrases and a small "every ..." pattern set map to RRULE strings.
 * Matched text is stripped; the remainder is the task name. A line the
 * parser cannot date still produces a name, never a failure.
 */

export type ParsedCapture = {
  name: string;
  /** Date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:MM), local time. */
  due?: string;
  /** Datetimes when the phone buzzes; set when the capture has a time. */
  reminders?: string[];
  /** One RRULE string, for example FREQ=MONTHLY. */
  recurrence?: string;
  /** The matched phrases, so callers can show what was consumed.
      Spans were dropped: stripping and squashing between matches
      made input indices drift, and no caller used them. */
  matches?: { kind: "date" | "recurrence"; text: string }[];
};

const RECURRENCE_WORDS: Record<string, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
  annually: "FREQ=YEARLY",
};

const WEEKDAY_CODES: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

const FREQ_BY_UNIT: Record<string, string> = {
  day: "DAILY",
  week: "WEEKLY",
  month: "MONTHLY",
  year: "YEARLY",
};

const RECURRENCE_PATTERNS: {
  pattern: RegExp;
  rule: (m: RegExpExecArray) => string;
}[] = [
  {
    pattern: new RegExp(
      `\\b(?:every|each)\\s+(mon|tues|wednes|thurs|fri|satur|sun)days?\\b`,
      "i",
    ),
    rule: (m) => {
      const full = Object.keys(WEEKDAY_CODES).find((word) =>
        word.startsWith(m[1].slice(0, 4).replace(/s$/, "")),
      );
      const day = WEEKDAY_CODES[full ?? m[1].toLowerCase()];
      return `FREQ=WEEKLY;BYDAY=${day}`;
    },
  },
  {
    pattern: /\bevery\s+other\s+(day|week|month|year)\b/i,
    rule: (m) => `FREQ=${FREQ_BY_UNIT[m[1]]};INTERVAL=2`,
  },
  {
    pattern: /\b(?:every|each)\s+(day|week|month|year)\b/i,
    rule: (m) => `FREQ=${FREQ_BY_UNIT[m[1]]}`,
  },
];

function strip(text: string, index: number, length: number): string {
  return `${text.slice(0, index)} ${text.slice(index + length)}`;
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseCapture(
  input: string,
  now: Date = new Date(),
): ParsedCapture | null {
  const original = squash(
    input.replace(/^(?:please\s+)?remind\s+me(?:\s+to)?\s+/i, ""),
  );
  if (original === "") {
    return null;
  }
  let text = original;
  let recurrence: string | undefined;
  const matches: { "kind": "date" | "recurrence"; "text": string }[] = [];

  const repeatMatch = /\b(?:repeats?|recurs?|recurring)\s+(daily|weekly|monthly|yearly|annually)\b/i.exec(
    text,
  );
  if (repeatMatch) {
    recurrence = RECURRENCE_WORDS[repeatMatch[1].toLowerCase()];
    matches.push({ kind: "recurrence", text: repeatMatch[0] });
    text = squash(strip(text, repeatMatch.index, repeatMatch[0].length));
  } else {
    for (const entry of RECURRENCE_PATTERNS) {
      const match = entry.pattern.exec(text);
      if (match) {
        recurrence = entry.rule(match);
        matches.push({ kind: "recurrence", text: match[0] });
        text = squash(strip(text, match.index, match[0].length));
        break;
      }
    }
  }

  const parsed = chrono.parse(text, now, { forwardDate: true });
  let due: string | undefined;
  let reminders: string[] | undefined;
  if (parsed.length > 0) {
    const first = parsed[0];
    const hasTime = first.start.isCertain("hour");
    due = formatLocal(first.start.date(), hasTime);
    if (hasTime) {
      reminders = [due];
    }
    matches.push({ kind: "date", text: first.text });
    text = squash(strip(text, first.index, first.text.length));
  }

  const name = squash(text) === "" ? original : squash(text);
  const result: ParsedCapture = { name };
  if (due) {
    result.due = due;
  }
  if (reminders) {
    result.reminders = reminders;
  }
  if (recurrence) {
    result.recurrence = recurrence;
  }
  result.matches = matches.sort(
    (a, b) => (a.kind === b.kind ? a.text.localeCompare(b.text) : 0),
  );
  return result;
}
