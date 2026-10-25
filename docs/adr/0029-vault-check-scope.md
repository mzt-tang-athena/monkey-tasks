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
