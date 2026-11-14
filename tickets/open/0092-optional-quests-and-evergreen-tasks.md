---
id: 0092
title: Optional quests and evergreen tasks in the planner
created: 2026-11-11
priority: low
assignee:
pr:
depends: []
---

## Spec

This is a discovery ticket. Do not build it until the spec, the data
shape and the interaction win the operator's agreement.

The source is `Inbox/202611032221.md` in the vault. The quote stays verbatim, so Vale skips it.

<!-- vale off -->

> **"Optional Quests"**
> - Events like figure drawing, muay thai, etc.
> - I can toggle on or off to see, these things I could participate in.
>   Could have a low-opacity background blur to them by default.
>
> **Evergreen Tasks?**
> - Things I always want to do but never schedule the time to.
> - Thing like reading, studying artists, playing specific steam games,
>   etc.
> - It could be these 'endless tasks' I could drag alongside into the
>   calendar.

<!-- vale on -->

The planner already has a day, a week and a month, drag targets and a
task pill source.
The idea adds a second kind of item to the calendar. That item is
available rather than owed.

Questions the discovery must answer:

1. Data. Is an optional quest a task note with a flag? Or a new
   note kind such as `kind: "[[events]]"`? Or a note in a new folder? Does it
   carry `due`, `recurrence`, an area, a cost and a duration, or only
   some of those?
2. Evergreen. How does it differ from a task with no due date? Does a
   drag into a day set `due` on the note? Does it create an occurrence
   note instead? What does done mean for a practice such as reading?
3. Appearance. The low-opacity quest belongs to the state recipe from
   ticket 0082. Define it there or in a dated amendment, so it never
   becomes a fourth ad hoc style.
4. Toggles. Where do the filters live, how do they read to TalkBack,
   and does the choice persist in `lib/settings.ts`?
5. The month view. A month cell with four optional quests must not turn
   into noise. Say what shows and what counts.

Deliver a spec in this ticket, with its data proposal and trade-offs.
Add two or three mockups on the real week and month views. Add an ADR
if a real alternative remains. Then the operator decides whether to
build.

## Acceptance

- [ ] This ticket carries the agreed data shape and its ADR.
- [ ] Two or three mockups show a quest in the week and in the month,
      along with the toggles. They also show an evergreen item dragged
      into a day.
- [ ] The operator picks a direction.
- [ ] The operator splits the build into child tickets, or drops the
      idea.
      No app code ships from this ticket.

## Outcome

(filled in before moving to done/)
