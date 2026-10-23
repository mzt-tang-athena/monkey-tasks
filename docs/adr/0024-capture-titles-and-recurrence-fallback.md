# 0024. Capture titles and the recurrence fallback

- **Status:** accepted
- **Date:** 2026-10-23

## Context

Ticket 0019 left two capture behaviours open because each needed a
product call.

A capture that is only a date ("tomorrow") strips to an empty name. The
parser titled the task with the phrase it consumed, in lower case.

A recurring task with no usable due date completed on the first tick
instead of moving forward.

## Decision

**Title the task with the date phrase, sentence case.** "tomorrow"
becomes "Tomorrow". Only the first letter changes, so "next friday"
becomes "Next friday" and a phrase that already starts with a digit is
left alone. A line whose only match is a recurrence word keeps its own
text, because chrono does not read it as a date and there is no date
phrase to borrow.

**Anchor a recurrence on now when the due date is missing or
unparseable.** The rule advances from today, so ticking never finishes a
recurring task by accident. A rule the parser cannot read is not
recurring, and the task completes as before.

## Consequences

A date-only capture produces a task that reads like a title and keeps
its due date. The name is a guess about intent, so it is deliberately
plain: the phrase the user typed, capitalised.

The recurrence fallback makes the tick path forgiving. A note with a
broken due value still moves forward, which is better than a task that
silently disappears from the list.

## Alternatives

**Refuse a date-only capture.** Honest, but it blocks the fastest way to
park something on a day.

**Title it "Untitled".** Loses the only information the user gave.

**Keep the completed task and flag it.** Adds a state to the list for a
note that is easy to fix by hand.
