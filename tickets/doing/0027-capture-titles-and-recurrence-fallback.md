---
id: 0027
title: Capture titles and the recurrence fallback
created: 2026-10-23
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

Two behaviours were left open by ticket 0019. Both are product calls now
made.

**A date-only capture.** "tomorrow" stripped to an empty name, so the
task was titled with the phrase it consumed, lowercase. The task is now
titled with that phrase in sentence case: "Tomorrow". A line that is
only a recurrence word keeps its own text, because chrono does not read
it as a date.

**A recurring task with no usable due date.** A recurrence with a
missing or unparseable due date already anchors on now, so it rolls
instead of completing. The rule was true but untested for a bad stored
value; both cases are pinned now.

## Acceptance

- [ ] "tomorrow" captures a task titled "Tomorrow" with tomorrow's due date.
- [ ] "next friday" is titled "Next friday" and keeps the rest of the phrase.
- [ ] A line chrono cannot date keeps its own text as the name.
- [ ] A daily rule with no due date rolls from today.
- [ ] A daily rule with an unparseable due date rolls from today.
- [ ] A rule the parser cannot read still completes the task.

## Outcome

(filled in before moving to done/)
