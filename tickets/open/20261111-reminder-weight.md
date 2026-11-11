---
title: Reminder weight
created: 2026-11-11
priority: high
assignee:
pr:
depends: ["0094-review-the-task-note-schema"]
---

## Spec

The operator wants two kinds of reminders.

- Harsh. A need to do. It should ring and be hard to miss.
- Dismissible. The task is a cue for a time, not urgent. It should be
  quiet and easy to clear.

Today `reminders` is a list of datetimes and `due` is a date or a
datetime. A timed due does not ring. Ticket 0094 settles that a timed
due rings by default. This ticket settles the weight.

The operator hates vague priorities such as low, medium and high. This
weight may be what they actually wanted from a priority field. Do not
add a P1 to P4 field.

Questions to settle:

1. Is the weight on the task, on each reminder, or a default on the
   list? A task usually has one intent, so a task property is the
   simplest. Say why if not.
2. Values. `harsh` and `soft`? `need` and `cue`? Pick words the
   operator will use out loud.
3. Notification behavior. A harsh alarm needs a channel, a sound and
   no easy dismissal. A soft one is silent, or a banner that clears on
   its own. Check both on the phone.
4. Escalation. Does a harsh reminder repeat when ignored? How many
   times, and when does it stop?
5. Vault shape. A frontmatter property is visible in Obsidian. What is
   the key and the values?
6. Recurrence. A spawned occurrence carries the same weight. Confirm.
7. Due and reminders. A harsh task with a due time and a reminder may
   ring twice. State the rule.

Deliver: a spec in this ticket, an ADR if a real alternative remains,
and a device check of the notification behavior. Do not build the field
before the operator decides.

## Acceptance

- [ ] The operator picks the field, its values and where it lives.
- [ ] The notification behavior for each weight is written down and
      checked on the phone.
- [ ] The vault shape is recorded and reads well in Obsidian.
- [ ] The build is split into child tickets, or the idea is dropped.

## Outcome

(filled in before moving to done/)
