---
id: 0008
title: Highlight parsed capture text
created: 2026-10-20
priority: low
assignee:
pr:
depends: [0006]
---

## Spec

In the capture box, show which words the parser understood. The goal
is user trust: you see the date and the recurrence light up as you
type, Todoist-style, instead of guessing what a capture will produce.

Simplest reliable form: a live preview line under the input that
renders the parsed pieces in place, with the date, reminder, and
recurrence parts colored and the remaining task name plain. The RN
TextInput is a plain field and cannot style inline text; the preview
avoids a custom input control. The parse result already carries the
matched spans, so the preview needs no new parsing.

## Acceptance

- [ ] typing a date or recurrence shows the matched words highlighted
      under the input
- [ ] the preview shows the final task name after stripping
