---
id: 0039
title: Calendar and list widgets on the home screen
created: 2026-10-24
priority: low
assignee:
pr:
depends: [0034]
---

## Spec

Two Android home screen widgets, for later.

- A calendar widget: today's tasks with their times, and a compact
  look at the coming days.
- A list widget: the open tasks of one chosen list.

A tap on a row opens the app at that task. A tap on the header opens
the app on that tab.

The vault lives behind a SAF grant. A widget runs outside the app's
process and cannot use that grant, so it cannot read the notes. The
app writes a small cache after every read and write, and the widget
renders the cache. The cache holds names, due values, lists and
completed state, nothing secret, and lives in app-private storage.

Widgets are native Android code, so this needs a dev client rebuild
and a config plugin. That is the main cost.

## Acceptance

- [ ] A calendar widget shows today's tasks with their times, and the
      next few days in a compact form.
- [ ] A list widget shows the open tasks of the list chosen when the
      widget is added.
- [ ] A row opens the app at that task; the header opens the tab.
- [ ] The widget refreshes after an app write and when the day rolls.
- [ ] The widget reads the cache, never the vault, and the cache holds
      no secrets.
- [ ] An empty list and an empty day each show a plain message.
- [ ] The widget follows the theme tokens it can reach.

## Outcome

(filled in before moving to done/)
