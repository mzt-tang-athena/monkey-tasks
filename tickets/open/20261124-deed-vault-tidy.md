---
title: A small tidy of the deed notes
created: 2026-11-24
priority: low
assignee:
pr:
depends: ["20261124-deed-board"]
---

## Spec

Contracts ADR `20261124-deeds-are-tasks-with-a-status` keeps the deed
notes as they are. A few notes still need a hand fix. This ticket
takes over ticket 0005, closed on 2026-11-24.

Keep it targeted. List each note you touch, and get the operator's
yes on the list first. No script rewrites all 72 deeds.

1. **`after` links.** 7 deeds carry one, and 1 of them spells it
   `do this after`. Go through each with the operator. A real "can't
   start until" becomes `blocked by`. A "do this next" becomes the
   deed's place on the board, set by a drag. Then remove `after`.
2. **Reference deeds.** 11 deeds have no status. They are reference
   notes. Move them to `Notes/` with `kind: "[[notes]]"`. Check that
   every link to them still resolves.
3. **Recurring checklists.** Some deed bodies hold a checklist the
   operator repeats. Turn each into a recurring task note. Leave
   one-off checkboxes in the body.
4. **From 0005.** Fold `types`, on 10 deeds, into tags or category
   links. Lose no meaning. Backfill `created` on the 15 deeds that
   lack it, from the vault history or file metadata. Wrap the 3 bare
   status values and the 1 bare `parent deed` in link brackets.
5. **Template and base.** The deed template drops `after` and
   `types`. In `deeds.base`, the Backlog and Done views filter with
   `!=` and show the opposite set. Fix both.

The board ticket comes first, so item 1 can set order by dragging.

## Acceptance

- [ ] The operator approved the list of notes before any change.
- [ ] No deed carries `after` or `types`.
- [ ] The 11 reference notes live in `Notes/`, and links resolve.
- [ ] Each recurring checklist is a recurring task note.
- [ ] `deeds.base` views show the set their names promise.
- [ ] The PR holds a before and after diff of every touched note.
- [ ] `npm run vault:check` passes on the vault afterward.

## Outcome

(filled in before moving to done/)
