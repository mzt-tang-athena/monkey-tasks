---
title: Deed progress over time
created: 2026-11-24
priority: low
assignee:
pr:
depends: ["20261124-app-reads-deeds-as-tasks"]
---

## Spec

Contracts ADR `20261124-deeds-are-tasks-with-a-status` names progress
as a goal. Progress means done items over time and time spent. It
does not mean checklists or a count of child deeds. This is a later
idea. Settle the shape with the operator before you build.

Two parts:

1. **Done over time.** A view of what got done, by week or month.
   It reads `completed` dates on tasks and deeds. Nothing new goes in
   the vault.
2. **Time spent.** Time entries on a task, start and end. The idea
   comes from the TaskNotes Obsidian plugin, which keeps a list of
   entries in frontmatter. This needs a contract field and an ADR
   first.

Questions to settle:

- Where the view lives: the board, the Journal tab, or its own place.
- How a code project shows progress. The game is one deed linked to
  its repo, and its steps are that repo's tickets. Read the repo's
  `tickets/done/`, or count only vault notes?
- How a timer starts and stops on the phone, and what a forgotten
  timer does.

## Acceptance

- [ ] The operator picks the view and where it lives.
- [ ] Time entries have a contract ADR before any code.
- [ ] Child tickets exist for each part the operator keeps.

## Outcome

(filled in before moving to done/)
