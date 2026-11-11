---
id: 0088
title: Journal tab
created: 2026-11-11
priority: high
assignee:
pr:
depends: [0082, 0083]
---

## Spec

The app is a task app today. The operator wants a third tab for the
journal. The vault already holds it at `Journal/Daily/YYYY-MM-DD.md`,
and the live notes look like this:

```markdown
---
banner_image: Attachments/Banners/sylvain-sarrailh-office.jpg
banner_position: 20
---

19:52
- Went out for dessert with others
- Fixing monkey-budget category and groups issues

![[daily.base]]
```

Interstitial journalling is a time, then bullets. The operator also
wants to log food through the day. The two child tickets cover the
note model and the food log.

This epic exists to group the work and to settle the format before any
screen is built. It waits for 0082 (the state recipe) and 0083 (runtime
themes), because both touch the bottom bar and every style sheet.

Children:

- 0089 the daily note model, the tab and the today view
- 0090 food log in the journal

Related but separate:

- 0091 reference notes on tasks
- 0092 optional and evergreen items in the planner

The vault is the source of truth. The app appends, and it does not
rewrite what Obsidian wrote. The note lives outside `Tasks/`, so the
journal gets its own query and its own adapter calls. The adapter
already handles any folder under the granted root.

## Acceptance

- [ ] 0089 and 0090 are done.
- [ ] The tab, the note format and the food convention are recorded in
      an ADR.
- [ ] `README.md` describes the journal tab and its vault paths.

## Outcome

(filled in before moving to done/)
