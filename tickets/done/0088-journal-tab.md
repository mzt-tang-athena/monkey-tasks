---
id: 0088
title: Journal tab
created: 2026-11-11
priority: high
assignee: claude-opus-5-5
pr: 143
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

This epic groups the work. It settles the format first, so no screen
work starts early. It waits for 0082 (the state recipe) and 0083
(runtime themes). Both touch the bottom bar and every style sheet.

Children:

- 0089 the daily note model, the tab and the today view
- 0090 food log in the journal

Related but separate:

- 0091 reference notes on tasks
- 0092 optional and evergreen items in the planner

The vault is the source of truth. The app appends, and it does not
rewrite what Obsidian wrote. The note lives outside `Tasks/`. For that
reason, the journal gets its own query and its own adapter calls. The adapter
already handles any folder under the granted root.

## Acceptance

- [x] Both 0089 and 0090 have finished.
- [x] An ADR records the tab, the note format and the food
      convention.
- [x] `README.md` covers the journal tab and its vault paths.

## Outcome

Shipped in #143 with 0089 and 0090. ADR 20261112-journal-format records
the path, the block grammar, append only, the create choice and the food
convention. A dated amendment covers the build. README describes the
Journal tab, its store and its vault paths.

An inline reference link's press area now covers its full 28 point rule.
The 44 point floor exempts it under WCAG 2.5.8 (ADR amendment
2026-11-16). The Journal tab and its open composer join the 44 point and
axe gates. Both run at 360 in the budget and midnight palettes.

A release APK on the Android emulator proved the SAF path on a real vault
folder. With no `Journal/` folder, a send created `Journal/Daily/` and the
day's note. On a day note with frontmatter and the `![[daily.base]]`
embed, three sends kept all 465 bytes before the embed. The embed stayed
last. Exact bytes are in PR #143.

The food marker stays provisional, and the fourth destination belongs to
0095.
