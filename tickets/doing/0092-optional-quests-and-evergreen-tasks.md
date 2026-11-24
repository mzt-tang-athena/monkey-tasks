---
id: 0092
title: Optional quests and evergreen tasks in the planner
created: 2026-11-11
priority: low
assignee: opencode-quests-lane
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
   ticket 0082. Define it there or in a dated amendment, so it does not
   become a fourth ad hoc style.
4. Toggles. Where do the filters live, how do they read to TalkBack,
   and does the choice persist in `lib/settings.ts`?
5. The month view. A month cell with four optional quests must not turn
   into noise. Say what shows and what counts.

Deliver a spec in this ticket, with its data proposal and trade-offs.
Add two or three mockups on the real week and month views. Add an ADR
if a real alternative remains. Then the operator decides whether to
build.

## Findings

Discovery run on 2026-11-24. No app code changed. The proposal
is ADR `20261124-optional-quests-and-evergreens`, status proposed.

### What the app does today

We seeded six weekly quests and three evergreens as plain task
notes in the web preview. The before shots show the problem:

- Day: the eight quests fall into Overdue, in red.
- Week: quests take the two chip slots. Thursday reads `+4`.
- Month: every quest day gets the owed-task dot.
- A drag of `Read a novel` onto Saturday writes
  `due: 2026-10-31` onto the evergreen note itself. It then
  leaves the pool, so the practice vanishes after one use.

Shots: [week](../../docs/assets/quests/before-week.png),
[month](../../docs/assets/quests/before-month.png),
[day](../../docs/assets/quests/before-day.png).

### One idea under both

A quest and an evergreen share one trait. The operator may do
it, and nothing breaks if they skip it. A quest has a date. An
evergreen has none. One marker on a task note can carry both,
and the date tells them apart.

### Three data shapes

**A. A flag on the task note.** `optional: true` on a
`kind: "[[tasks]]"` note. A quest is an optional note with a
`due`, and a `recurrence` when it repeats. An evergreen is an
optional note with no `due`.

**B. New note kinds.** Two new kinds live in a new `Quests/`
folder: `kind: "[[quests]]"` and `kind: "[[evergreens]]"`.
Today any other kind inside `Tasks/` fails `taskFrontmatter`.
It lands in the repair block, so B needs its own folder and
reader.

**C. Named lists, no schema change.** Quests live in
`list: "[[Quests]]"`, evergreens in `list: "[[Evergreen]]"`.
The planner reads those two list names from settings.

| | A. Flag | B. New kinds | C. Named lists |
|---|---|---|---|
| Contract change | One property | Two schemas | None |
| Reader change | None | New folder and kind | None |
| Editor, capture, drag | Reused | Taught twice | Reused |
| Lists screen | In its list | Never shown | Two new tabs |
| Quest in Focus too | Yes | No | No, one list |
| Rename breaks it | No | No | Yes |
| Cost to build | Small | Large | Smallest |

A wins on cost per behavior. C costs less up front, but its
meaning hangs on a list name and steals the one list slot.
B is the cleanest model and the most code: every task feature
would need a twin.

### Answers to the five questions

**1. Data.** Shape A. A quest carries `due`, `recurrence` and
`list` as any task does. It carries no duration, cost or area.
The timeline draws a task at its hour, with no length, so a
duration has no reader yet. Contract cost: one boolean in
`contracts/packages/schemas`, read from `true` and `false`.
`optional` changes these rules:

- Never overdue, never in the Overdue group.
- Never rings. A `reminders` entry still rings.
- Draws with the available mark (answer 3).

**2. Evergreen.** It differs from a no-date task in two ways.
It never leaves the pool, and nobody ticks it. A drag into a
day does not set `due` on the evergreen. It creates a new owed
note, `Read a novel 2026-10-31.md`, with `title`, `due` and a
body line `From [[Read a novel]].` This reuses the occurrence
naming from ADR 0027. The link lives in the body, per ADR
`20261111-task-note-schema`, so it costs no property. Done
means ticking that day's note. The evergreen itself ends only
when you complete or delete it in the editor. Obsidian
backlinks on the evergreen then show every time you did it.

A recurring quest needs one change in the tick path. Today a
tick completes the note at its stored `due`. A skipped quest
keeps an old `due`, so a tick spawns the next one in the past.
For an optional note, a tick on day D first writes `due: D` on
the completed note. Then it spawns the next after D.

**3. Appearance.** Add one state to the 0082 recipe as a dated
amendment to ADR `20261116-icon-buttons-carry-state-in-the-glyph`.
Rule: an available item draws as an outline. An owed one draws
filled.

- Chip and pill: dashed `inkFaint` hairline, no fill.
- Text: `inkMuted`, which passes 4.5 to 1 in all four
  palettes per `theme-contrast.test.ts`.
- A hollow `inkMuted` ring where owed items draw a bar or dot.

We drop the source note's low opacity and blur. Opacity on text
breaks the 0082 contrast rule. React Native on Android has no
cheap backdrop blur. The outline keeps the same quiet read.

**4. Toggles.** Two icon switches in the list head row, beside
the source toggle, in day, week and month. Compass for quests,
plant for evergreens. They follow the glyph ADR: outline
`inkMuted` when hidden, filled `ink` when shown. Each has role
`switch`, so TalkBack reads "optional quests, switch, on".
The choice persists in `lib/settings.ts` as two keys,
`showQuests` and `showEvergreens`, each `shown` or `hidden`.
Both default to shown. The row is tight at 360 wide, so the
build ticket checks it there.

**5. Month.** A cell shows at most two marks and never a count:

- One filled dot when any owed task falls there.
- One hollow ring when any quest falls there.
- Evergreens never show. They have no date.

Four quests on a Thursday still draw one ring. The cell's name
counts them apart: "Thursday 29, 2 tasks, 4 optional quests".
The month list leaves quests out. A picked day lists owed tasks,
then an `Optional` group with outline rows.

**Week.** Owed tasks take the two chip slots first. A quest
fills a free slot, in time order. A quest with no slot leaves a
hollow ring by the date. `+N` counts owed tasks only.

### Mockups

Painted over the live web preview: real notes, real layout,
the quest marks drawn on top. Budget palette, 412 by 915.

- [Week with quests](../../docs/assets/quests/mock-1-week-quests.png)
- [Month, Thursday picked](../../docs/assets/quests/mock-2a-month-quests.png)
- [Month, Optional group](../../docs/assets/quests/mock-2b-month-optional-group.png)
- [Evergreen mid-drag](../../docs/assets/quests/mock-3a-evergreen-drag.png)
- [Evergreen dropped](../../docs/assets/quests/mock-3b-evergreen-dropped.png)

The journeys that paint them, and the raw evidence, are in
`~/code/monkey-tasks/worktrees/evidence-quests/`.

### For the operator

- Shape: A flag, B kinds, or C lists?
- Evergreen drop: a new dated note, or set `due` on it?
- Quest tick: keep "I went", or no tick at all?
- Mark: outline for available, no opacity or blur?
- Toggles: head row icons, or the Settings screen?
- Default: quests shown, or hidden until switched on?

Recommendation: shape A, a new dated note per drop, a tick that
means "I went", and the outline mark. Then split the build into
the contract field, the planner marks, the toggles, and the
evergreen strip with its drop.

## Acceptance

- [ ] This ticket carries the agreed data shape and its ADR.
- [x] Two or three mockups show a quest in the week and in the month,
      along with the toggles. They also show an evergreen item dragged
      into a day.
- [ ] The operator picks a direction.
- [ ] Split the build into child tickets, or drop the idea.
      No app code ships from this ticket.

## Outcome

(filled in before moving to done/)
