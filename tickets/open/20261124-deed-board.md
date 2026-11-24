---
title: A deed board grouped by status
created: 2026-11-24
priority: normal
assignee:
pr:
depends: ["20261124-app-reads-deeds-as-tasks"]
---

## Spec

Contracts ADR `20261124-deeds-are-tasks-with-a-status` decides that a
deed is a task with a status. The operator wants a short board of what
is now and what is next. This ticket builds it.

- Group deeds by status: active, backlog, someday. Done and dropped
  sit in folded groups at the end, like a list tab's Completed group.
- Tap a deed's status to change it. A picker offers the five values.
- Setting done writes status done and `completed` together, in one
  write. Leaving done removes `completed`. Ticking a deed does the
  same as setting done.
- Drag a deed to order it inside its group. The drag writes `order`,
  as My order does on a list tab.
- A deed is not ready while a `blocked by` link reaches a note that is
  not done. Show it as not ready, and name the blocker. A link that
  reaches no note does not block. `vault:check` names it.
- Tap a deed's title to open it in the task editor.
- No cap on active deeds.

Pick the entry point. The bottom bar fits four tabs and the Add pill
at 360pt, so a fifth tab needs a check. A tab on the Lists pager is
the other plain option. Record the pick in an ADR.

Prove it with the `verify-monkey-tasks` skill, on the web preview and
on the Android emulator.

## Acceptance

- [ ] The board shows active, backlog and someday groups in order.
- [ ] A status change shows at once and lands in the note.
- [ ] Setting done writes `completed`. Leaving done removes it.
- [ ] A drag keeps its place after a reload.
- [ ] A deed blocked by an open note shows as not ready.
- [ ] The board passes the gallery's touch target and axe checks.

## Outcome

(filled in before moving to done/)
