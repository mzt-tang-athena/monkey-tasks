---
title: Command pane from anywhere
created: 2026-11-18
priority: high
assignee: omp
pr: 168
depends: []
---

## Spec

The operator picked three changes to the command pane's way in, from a
mockup shown on 2026-11-18. They then moved the gesture to the bar.

1. The Planner header drops its "open commands" chevron and its "open
   settings" gear. Day, Week and Month take the width. The Lists
   toolbar drops its "open commands" chevron too.
2. A downward swipe on the bottom bar's empty gap opens the pane. The
   gap sits between the last tab and the split Add pill, and it holds
   no control. The pane still drops from the top edge, and a pull up on
   its top closes it. A pull on a list body only scrolls or refreshes.
   The header bands carry no pull.
3. The accessible opener lives in the bottom bar as a split Add pill.
   The left half draws the plus and runs the tab's own Add. The right
   half draws Phosphor's Command glyph and opens the pane. Both halves
   are 44pt squares with a hairline divider, so the pill is about 89pt.
   Each half has its own name, so TalkBack and a keyboard reach both.

Pull-to-refresh stays on Lists and Journal. The pane gains a "Reload
vault" command. It rereads every vault query, as the app does when it
returns to the foreground.

Glyph sizes stay as they are. A follow-up lane grows them to 24pt.

## Acceptance

- [x] the Planner header has no chevron and no gear
- [x] the Lists toolbar has no "open commands" button
- [x] a gap swipe opens the pane, with the search focused
- [x] a tab or pill swipe opens no pane and no sheet
- [x] a list body pull refreshes and opens no pane
- [x] the pane lists "Reload vault" and it rereads the folder
- [x] the pill draws a plus half and a Command half, both 44pt
- [x] four tabs and the pill fit a 360pt bar
- [x] the ADR amendment records the gesture and the opener

## Outcome

Merged in #168.
- A downward swipe on the bar's gap opens the pane.
- The gap is the empty middle, with no control of its own.
- A tab, pill, header band or list body opens no pane.
- Pull-to-refresh is back on Lists and Journal.
- The list's scroll component builds its own refresh control.
- The browser keeps the bare scroller, so pager swipes turn.
- Reload vault rereads every vault query.
- The bar's split pill is two 44pt halves.
- The Planner header lost its chevron and gear.
- The Lists toolbar lost its chevron.
- ADR 20261111-command-pane has a dated amendment.
- Web: 632 passed, 26 skipped, 0 failed. The commands spec is 44.
- Android: the gap swipe, refresh, drag, swipe and 360dp pass.
- Evidence: `app/build/verify/evidence`, the last two runs.
