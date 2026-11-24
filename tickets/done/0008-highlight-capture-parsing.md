---
id: 0008
title: Highlight parsed capture text
created: 2026-10-20
priority: low
assignee: omp
pr: PRNUM
depends: [0010]
---

## Spec

The capture sheet shows the words the parser understood. A live
preview line under the input renders each parsed piece in place.
Date, reminder, and recurrence parts get color, and the remaining
task name stays plain. The RN TextInput cannot style inline text, so the preview skips
a custom input. The parse result already carries the matched
spans. (Approach revised 2026-10-20 after the capture sheet design.)

## Acceptance

- [ ] typing a date or recurrence highlights the matched words
- [ ] the preview shows the final task name after stripping

## Outcome

Stale, not built. The capture sheet shows parse chips (`capture-chips.tsx`) in place of highlighted spans. The parser dropped spans, since no caller used them. Closed in the 2026-11-24 ticket sort.
