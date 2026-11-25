/**
 * Which project each spec runs in, and why (ticket
 * 20261119-run-motion-free-specs-once).
 *
 * A spec that checks a transition, a spring, a frame or the absence of
 * one runs in both projects, because `reduced-motion` is the other half
 * of that check. Every other spec runs once, in `motion`, and says what
 * it asserts instead. The suite refuses to start when a spec has no
 * mark, so a new spec has to answer the question.
 *
 * A journey named here runs once too, and every other journey runs in
 * both projects.
 */
export type MotionMark = {
  runsIn: "both" | "once";
  why: string;
};

export const marks: Readonly<Record<string, MotionMark>> = {
  "add-button.spec.ts": {
    runsIn: "both",
    why: "reads the button's mid-swipe travel, and that reduce holds it still",
  },
  "capture-clock.spec.ts": {
    runsIn: "both",
    why: "samples the sheet, scrim and bar every frame, then the reduce path",
  },
  "celebration.spec.ts": {
    runsIn: "both",
    why: "watches the burst per frame, and that reduce paints none",
  },
  "motion.spec.ts": {
    runsIn: "both",
    why: "reads the swipe on a stopped clock, then the reduce path",
  },
  "motion-surfaces.spec.ts": {
    runsIn: "both",
    why: "checks the menu entrance and its absence under reduce",
  },
  "pagers.spec.ts": {
    runsIn: "both",
    why: "steps the settle frame by frame and checks the reduce track",
  },
  "planner-day.spec.ts": {
    runsIn: "both",
    why: "the day a route keeps, which must not depend on the motion setting",
  },
  "planner-drag.spec.ts": {
    runsIn: "both",
    why: "samples the ghost per frame, the lift shake and its absence",
  },
  "planner-period.spec.ts": {
    runsIn: "both",
    why: "reads the mark's live position mid-swipe, frame by frame",
  },
  "planner-split-first-frame.spec.ts": {
    runsIn: "both",
    why: "checks the first painted frame of the split",
  },
  "planner-split.spec.ts": {
    runsIn: "both",
    why: "checks the mid-swipe preview and the month grid's first frame",
  },
  "press.spec.ts": {
    runsIn: "both",
    why: "presses in the row's first layout frame, before its entrance lands",
  },
  "reorder.spec.ts": {
    runsIn: "both",
    why: "checks the tick regroup at 100 and 600 ms, and the reduce path",
  },
  "sheet-drag.spec.ts": {
    runsIn: "both",
    why: "checks the spring back from a short drag",
  },
  "tab-order.spec.ts": {
    runsIn: "both",
    why: "the bar and the pane's order, which do not depend on the motion setting",
  },
  "vault.spec.ts": {
    runsIn: "both",
    why: "checks the tick's wash while the write is slow, and reduce's own",
  },

  "a11y.spec.ts": {
    runsIn: "once",
    why: "names, roles, targets and axe; every read waits for the end state",
  },
  "capture.spec.ts": {
    runsIn: "once",
    why: "the typed phrase's parse and its note, read after the send lands",
  },
  "capture-dock.spec.ts": {
    runsIn: "once",
    why: "layout boxes and focus order on a wide window; no frame is read",
  },
  "commands.spec.ts": {
    runsIn: "once",
    why: "the pane's open and closed states, each polled until it rests",
  },
  "crash-log.spec.ts": {
    runsIn: "once",
    why: "the stored crash report and the text it shares",
  },
  "focus-ring.spec.ts": {
    runsIn: "once",
    why: "the focus mark's outline style, drawn at rest",
  },
  "fold.spec.ts": {
    runsIn: "once",
    why: "the Completed group's presence, count and axe; no entrance",
  },
  "gallery.spec.ts": {
    runsIn: "once",
    why: "colors, sizes and axe on every primitive at rest",
  },
  "inbox-title.spec.ts": {
    runsIn: "both",
    why: "the title is absent once the tab settles, with and without reduce",
  },
  "inbox-notes.spec.ts": {
    runsIn: "once",
    why: "note text, frontmatter and axe around the composer",
  },
  "journal.spec.ts": {
    runsIn: "once",
    why: "the note a send writes, the composer and axe",
  },
  "lists.spec.ts": {
    runsIn: "once",
    why: "tabs, order and chrome at rest; a swiped page is read once landed",
  },
  "network-change.spec.ts": {
    runsIn: "once",
    why: "a boot request that fails and the reload that follows it",
  },
  "planner.spec.ts": {
    runsIn: "once",
    why: "a swipe's landed day, week or month, and what it holds",
  },
  "references.spec.ts": {
    runsIn: "once",
    why: "the picker's matches, the note on disk and the sheet at rest",
  },
  "settings.spec.ts": {
    runsIn: "once",
    why: "the picker's stored choice and the screens it repaints",
  },
  "scroll-edge.spec.ts": {
    runsIn: "once",
    why: "the hairline's opacity and color once it settles",
  },
  "sort-default.spec.ts": {
    runsIn: "both",
    why: "the stored order, which must read the same under reduce",
  },
  "tasks.spec.ts": {
    runsIn: "once",
    why: "row text, the sections it folds into, and the note a tick writes",
  },
  "theme.spec.ts": {
    runsIn: "once",
    why: "palette colors and axe, each polled to its final value",
  },
};

/** The specs and journeys that run once, in the `motion` project only. */
export const motionFree: string[] = Object.entries(marks)
  .filter(([, mark]) => mark.runsIn === "once")
  .map(([file]) => file)
  .sort();

/** What is wrong with the marks, given the spec files on disk. */
export function markProblems(specs: string[]): string[] {
  return [
    ...specs
      .filter((file) => !(file in marks))
      .map((file) => `${file} has no mark`),
    ...Object.keys(marks)
      .filter((file) => !specs.includes(file))
      .map((file) => `${file} is not a spec here`),
  ];
}

