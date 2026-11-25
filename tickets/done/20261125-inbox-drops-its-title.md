---
title: The Inbox tab drops its title
created: 2026-11-25
priority: normal
assignee: lane-inbox-title
pr: 229
depends: []
---

## Spec

The operator's feedback on 2026-11-25: the Inbox tab doesn't need the
words "Inbox Notes" at its top. `inbox-header.tsx` draws them beside
the note count.

- Remove the title. Keep the note count as a small line, unless frames
  show it orphaned. Then show the operator both.
- Keep the tab's accessible name, so TalkBack still names the screen.
- Check the other tabs for the same title. Ask before removing one.

## Acceptance

- [x] The Inbox tab shows no "Inbox Notes" title on the phone.
- [x] TalkBack still names the screen.
- [x] Emulator frames before and after.

## Outcome

The header drew "Inbox Notes" in title type beside the count. It now
draws only the count, in muted meta type, with the testID `inbox-header`.
The count line carries `accessibilityRole="header"` and the name
"Inbox Notes, N notes". TalkBack then says the screen's name and the
count as one line. The bar's tab label still reads "Inbox Notes".

Proof: a release APK on the emulator at port 5566, before and after.
Shots and dumps sit in `evidence-inbox-title` (`inbox-before.png`,
`inbox-after.png`). The after dump shows the line as
`content-desc="Inbox Notes, 7 notes"`. A web spec,
`inbox-title.spec.ts`, checks for no visible "Inbox Notes" in the screen.
It also checks a heading with that name, in both motion projects.

I checked the other tabs and left them alone. Lists names itself on the
floating toolbar, the planner shows a month eyebrow, and the journal
shows the day's date. None repeats its tab name at the top of the
screen.
