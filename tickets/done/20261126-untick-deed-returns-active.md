---
title: An un-ticked deed returns to Active
created: 2026-11-26
priority: normal
assignee: pstack-lane
pr: 259
depends: []
---

## Spec

Un-ticking a done deed writes `[[backlog]]` today, so a Someday deed
quietly moves to Backlog. The operator decided on 2026-11-26: an
un-ticked deed returns to Active.

- `statusFor` in `app/src/stores/tasks/task-actions.ts` picks the
  status for a tick and for a reopen. A reopen writes `[[active]]`.
- The row tick, the optimistic row and the reopen write all use it.
- The reminder buttons only complete a task, so they never reopen.
- The Board's drag out of Done and the editor's status picker already
  write the status the user chose. Both keep that.
- A plain task with no `status` stays plain when un-ticked.
- Contracts ADR `20261124-deeds-are-tasks-with-a-status` does not
  name a reopen status, so it takes no contracts amendment.

## Acceptance

- [ ] A row tick on a done deed writes `status: "[[active]]"`.
- [ ] The optimistic row shows Active before the write lands.
- [ ] A plain task un-ticks with no `status` line added.
- [ ] The Board drag out of Done and the editor picker keep their status.
- [ ] Web e2e on the Board: tick a Someday deed, un-tick it, it
      lands in Active. It passes in both motion modes.
- [ ] Changelog line under `## 1.4.0 - unreleased`.

## Outcome

`statusFor` writes `[[active]]` on a reopen. A plain task still
writes no status. The Board drag and the editor picker are as they
were. Unit tests cover the status, the optimistic row and a plain
task. A Board e2e ticks a Someday deed, un-ticks it, and finds it in
Active, in both motion modes. ADR `20261126-untick-returns-active`
records the choice. Contracts needed no change.
