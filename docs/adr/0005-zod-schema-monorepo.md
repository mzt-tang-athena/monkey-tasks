# 0005. One schema package with hand-written Zod models

- **Status:** accepted
- **Date:** 2026-10-17

## Context

The app, athena tools, and a future MCP server all read the same task
notes. Duplicated model definitions drift. Schema generators infer shapes
from samples but not meaning: they cannot know that `repeat: weekly` is a
closed set or that `due` is a date.

## Decision

The repo is a monorepo. `packages/schemas` holds hand-written Zod models
as the single source of truth for the note vocabulary. TypeScript types
derive from the schemas. JSON Schema for server-side validation is
generated from them when a need appears. Quicktype is rejected: a one-time
generator is not worth installing.

## Consequences

Every client validates against identical definitions, so code and contract
cannot drift. A new property means editing one file. Writing schemas by
hand costs an hour up front and buys ownership of the vocabulary.

Amendment 2026-10-19: the schemas moved to the central contracts repo
(ADR 0007). The reasoning stands unchanged: hand-written Zod as the
single contract. Only the location changed. The monorepo framing for
this project is superseded by the home-wide contracts repo.
