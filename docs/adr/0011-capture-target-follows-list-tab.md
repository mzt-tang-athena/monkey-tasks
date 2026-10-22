# 0011. Capture target follows the current list tab

- **Status:** accepted
- **Date:** 2026-10-21

## Context

The capture panel preselects a target list with a prop. The bar reads
that prop once, when the screen mounts. Tabs change later, so the pill
stayed on Main even on the Focus tab.

The alternative fix lives inside the bar component: an effect that
re-reads the prop. That file is off limits this round. Another agent
edits it at the same time, and same-file edits break the merge.

## Decision

We key the bar by the active tab name on the Lists screen. The new tab
mounts a fresh bar, and the fresh bar reads the fresh default pill.

## Consequences

The pill follows the active tab. Any draft text in the panel is lost on
a tab switch. The tabs sit under a scrim while the panel is open, so
the user cannot switch while typing; the loss stays theoretical. A
following round can move the re-read into the bar and drop the key.

## Amendment, 2026-10-22

The re-read moved into the bar, and the key is gone. The bar now reads the
default target when that prop changes. The key made the whole bar remount
on a tab switch, and the bar jumped for a frame while it came back. The
re-read is a small state update instead, so the bar stays where it is.
