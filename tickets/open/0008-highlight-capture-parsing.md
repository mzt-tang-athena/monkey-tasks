---
id: 0008
title: Highlight parsed capture text
created: 2026-10-20
priority: low
assignee:
pr:
depends: [0010]
---

## Spec

The capture sheet shows which words the parser understood. A live
preview line under the input renders the parsed pieces in place:
date, reminder, and recurrence parts colored, remaining task name
plain. The RN TextInput cannot style inline text; the preview avoids
a custom input control. The parse result already carries the matched
spans. (Approach revised 2026-10-20 after the capture sheet design.)

## Acceptance

- [ ] typing a date or recurrence highlights the matched words
- [ ] the preview shows the final task name after stripping
