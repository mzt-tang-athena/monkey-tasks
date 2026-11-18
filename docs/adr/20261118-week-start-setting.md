# The week starts on Monday, and that is a setting

- **Status:** accepted
- **Date:** 2026-11-18

## Context

The week planner ran Sunday to Saturday.
The month grid's header and first row did the same.
The week strip, the Due picker's month grid and the week name in the
source toggle followed.

The operator asked for Monday first, with a setting for Sunday.
Monday is also the ISO week's first day. The app already numbers
weeks from Monday in `isoWeek`.

The planner reads its week bounds from `startOfWeek` in
`features/planner/model.ts`.
Every week-ordered surface calls it, or lays its own grid out from
`Date.getDay()`.

## Decision

Add a `weekStart` setting, `"monday"` or `"sunday"`, in the app's
own settings file. Monday is the default, for a fresh install and for
one that already has settings saved.

`startOfWeek(date, weekStart)` takes the setting as a required
argument.
Every caller passes the live value from `useSetting`.
A pure helper in `utils/dates` gives the day's place in the week.
Another gives the weekday names in the week's order.
The two month grids and the week strip then share one rule.

Recurrence keeps its meaning. An RRULE is an iCalendar value with a
Monday-based `WKST` default, so `lib/recurrence.ts` does not read the
setting. Only display order and week bounds move.

## Consequences

A week is Monday to Sunday by default.
The strip names a week by its new range.
The source toggle says "Due 9 to 15 Nov" where it said
"Due 8 to 14 Nov".

An install that saved settings before this change has no `weekStart`
key.
`loadSettings` fills it with the default, so the first launch after
the update shows Monday, not Sunday.
That is what the operator asked for.
A user who wants Sunday picks it in Settings.

The setting reaches the screens through the live store.
A change then redraws a mounted planner.
The week pane mounts again on a change, because its pager counts
from the week it started on.

Alternative: keep Sunday and add Monday as the option.
It would not change anyone's week on update.
The operator asked for Monday as the default, and ISO weeks already
start there.

Alternative: store the setting in the vault.
A device preference like the palette does not belong in a vault
that more than one device reads.
The settings file already holds the other screen settings.
