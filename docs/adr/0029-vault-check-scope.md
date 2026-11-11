# 0029. The vault check reads the folders the app owns

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Ticket 0037 asked for a check over every note in the vault. A trial run
over the real vault found 93 parser differences in 42 notes. All of
them sat outside the app's folders: `banner_position: 20` in journal
notes, `tags: [a, b]` in agent notes, `year: 2025` in a review. None of
them can break the app, which reads three folders. Reporting them would
bury the findings that matter.

## Decision

The command walks every note. The schema check and the parser check run
on `Tasks/`, `Tasks/Lists/` and `Deeds/`. The bare wikilink check runs
on every note, because a bare link corrupts any note the next Obsidian
edit rewrites.

## Consequences

The check stays quiet on a healthy vault: 390 notes, no findings. A
journal note with a number where the app expects a string stays out of
the report. The cost: a nested value outside the three folders goes
unreported, even though Obsidian reads it differently. Widening the
scope is a one-line change; the walk already covers the whole vault.

## Amendment, 2026-10-26: a list indented with a tab

Ticket 0053 made the app's parser read list items at any indent: none,
spaces, or a tab. YAML forbids a tab in indentation, so `js-yaml`
refuses a note that has one. The check keeps that finding. The app
reads the list, so the task stays on its list tab. A YAML reader does
not, so the note is still unsafe for other tools. The fix is to put
spaces in place of the tab.

We did not make the check accept a tab. That would hide a note that a
YAML reader cannot read, and finding those notes is the job of the
check.
