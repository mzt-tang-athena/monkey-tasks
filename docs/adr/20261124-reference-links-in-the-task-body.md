# A task's references live in its body

- **Status:** accepted
- **Date:** 2026-11-24

## Context

A task can point at a note in the vault's `References` folder. The
example is a groceries item that links to the oatmeal note. Obsidian
already reads a wikilink in a note body, so the link works there with
no help from the app.

A task note carries ten frontmatter fields. The schema ADR
`20261111-task-note-schema` says a reference stays in the note body,
with no extra rules until a case needs them. Ticket 0091 is that case.

The app reads the Tasks folder on every vault read. A second folder,
`References`, holds the notes a task points at.

## Decision

We write the link in the task body under a `## Reference` heading, one
wikilink per line:

```markdown
## Reference

[[oatmeal]]
```

The app parses that section, writes it, and removes one link at a time.
The body is the only source. The editor's Reference tile calls the same
two functions as the capture sheet. A link then reads the same either
way.

The picker reads the `References` folder through the vault adapter.
The app caches that query until it returns to the foreground. Typing
then filters in memory and never reads the folder.

We rejected a frontmatter list of links. It would need a new schema
field and a contracts release. The app is the only reader today, so
the cost has no payoff yet. If a later feature queries references
across all tasks, the parser can read the body. The trade then stays in
one function.

We rejected a picker built on the command pane. The pane is a search
over commands that draws at the window edge. A picker sits over its
sheet, so it reuses the shared picker sheet and the List picker's
search row instead.

## Consequences

The link renders in Obsidian and the app with no conversion.

A file change is one body write. Attach and detach splice the section
and leave every other line alone. Frontmatter and other sections
survive.

A note that a task points at can leave the folder. The preview then
says so and offers to detach the link. The task keeps its text until
the user chooses.

The row shows the link names under its meta line. That line is one
line tall, so a task with many links reads its first line only.

Nothing enforces the section's shape. A hand-written heading works,
and a link written elsewhere in the body is not a reference.
