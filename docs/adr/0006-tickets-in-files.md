# 0006. Tickets are markdown files in the repo

- **Status:** accepted
- **Date:** 2026-10-17

## Context

Work must be claimable by any harness without coupling to one tool. GitHub
Issues exist and have a board, but they need the network and a token, and
they would split the source of truth between the repo and GitHub.

## Decision

The ticket queue lives in `tickets/` as markdown files with frontmatter.
Folders carry the state: open, doing, done. The rules live in
`tickets/README.md`. The org project template carries the same convention,
so every new project starts with it.

## Consequences

Any agent or human claims work with a file move and a commit, and git
history is the audit trail. A kanban view does not exist until someone
wants it; the folders are the board. If GitHub Issues are wanted later, a
script imports the frontmatter, so nothing blocks the move.
