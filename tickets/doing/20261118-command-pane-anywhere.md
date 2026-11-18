---
title: Command pane from anywhere
created: 2026-11-18
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The operator picked three changes to the command pane's way in, from a
mockup shown on 2026-11-18.

1. The Planner header drops its "open commands" chevron and its "open
   settings" gear. Day, Week and Month take the width. The Lists
   toolbar drops its "open commands" chevron too, because the bar
   carries the opener on every tab. Settings stays in the command pane
   and in the Lists three-dot menu.
2. A pull down at the top of any page opens the pane. That holds on
   Lists, Planner, Journal and Inbox Notes, as Obsidian does it. The
   pull runs only while that page's scroll sits at the top. It never
   fights a row drag, the pager's sideways swipe, the day split or a
   sheet. Pull-to-refresh leaves all three tabs, so the pull belongs
   to the pane. The pane gains a "Reload vault" command. It rereads
   the vault, as the app already does on return to the foreground.
3. The accessible opener moves into the bottom bar as a split Add
   pill. Both halves are 44pt squares with a hairline divider, about
   89pt wide. The left half draws the plus and keeps the tab's Add
   action. The right half draws Phosphor's Command glyph and opens the
   pane. Each half has its own name. TalkBack and a keyboard reach
   both.

Glyph sizes stay as they are. A follow-up ticket grows them to 24pt.

## Acceptance

- [ ] the Planner header has no chevron and no gear, and the mode
      switch fills the row
- [ ] the Lists toolbar has no "open commands" button
- [ ] a pull at the top of Lists, Planner, Journal and Inbox Notes
      opens the pane
- [ ] a pull on a page scrolled away from the top only scrolls
- [ ] a row drag, a pager swipe, a day-split drag and a sheet never
      open the pane
- [ ] Lists and Journal have no pull-to-refresh; Inbox Notes has none
- [ ] the pane lists "Reload vault" and it rereads every vault query
- [ ] the bar's Add pill draws a plus half and a Command half. Both
      are 44pt, named "add task" and "open commands"
- [ ] four tabs and the pill fit a 360pt bar
- [ ] the ADR amendment records the pull, the refresh move and the
      opener
