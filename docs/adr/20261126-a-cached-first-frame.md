# A cached first frame

- **Status:** accepted
- **Date:** 2026-11-26

## Context

A cold start draws a skeleton until the vault read lands. The read got
faster (ADR `20261125-notes-read-on-the-io-pool`). A phone with a large
vault still waits a second or more, and the skeleton says nothing.

The vault is the truth. It can change while the app sits closed. A
cached frame is a guess the app makes from its own last look.

## Decision

We keep last session's rows in app storage and draw them in the first
frame, while the read runs.

- **The tab a cold start opens on.** Today leads the strip while it stays
  on. Main leads when Today is off. We keep only that tab's rows, at
  most 200. The file then holds what the first frame draws. The Board
  stays out, because its rows drag.
- **App storage, never the vault.** The file sits beside the settings
  file in the app's documents folder. No note gains a property, so the
  schema does not move.
- **The read always wins.** Cached rows carry no update time. The query
  draws them until a read stamps a time, and the read replaces them in
  full. A note changed, added or deleted while the app sat closed shows
  after it. No cache entry ever answers a read.
- **Dated rows.** The file names its granted folder and its Tasks
  folder. A different grant drops it. A read that names another Tasks
  folder drops it too. A vault that moved never draws.
- **Untappable, dimmed, with a line.** A cached row draws at 55%
  opacity under a "Syncing your vault" line. It takes no tick, no press
  and no drag. A tap on a stale row could tick a note the user no longer
  wants done. It could also open a note the vault no longer holds. The
  clear-completed action reads rows too, so it reads none until the read
  lands. The planner waits for the read rather than drawing part of the
  vault.

We weighed two other frames:

- **The skeleton alone.** It tells the truth, but it says nothing. It
  also fails to fix the wait this ticket is about.
- **An interactive stale frame.** It draws the same rows and lets a tap
  through. A tick then writes before the read, and the user cannot see
  that the list is old. We kept it out.

## Consequences

A cold start shows rows once it reads the folder grant. It no longer
waits for the whole vault read.

The cached frame can be wrong for the length of the read. The dimming
and the line say so. The read corrects it, in full.

The cache adds one file and one read of it at boot. A write follows a
read that changes the rows. That is one small write per session at most.

The Board, the planner and other tabs wait for the read. Those tabs do
not sit where a cold start opens.
