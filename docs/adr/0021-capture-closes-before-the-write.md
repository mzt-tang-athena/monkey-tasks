# 0021. Capture closes before the write

- **Status:** accepted
- **Date:** 2026-10-22

## Context

Pressing send in the capture sheet waited for the note to reach the
vault before the sheet moved. On a local provider that is two SAF calls.
On a cloud provider it can be a second or more. Meanwhile three
separate mechanisms drove the exit. The first was a 200 ms JS animation.
The second was a 220 ms timer that unmounted the sheet. The third was
the platform keyboard animation, which only started when the focused
input unmounted. The user saw a frozen sheet, then a fade. Then came a
gap with no sheet and the keyboard still up.

## Decision

The tap is the end of the interaction. It blurs the input and closes the
sheet in the same frame. The store inserts the row before it writes the
note, so the list is already correct under the closing sheet. The write
runs behind both.

The sheet and the keyboard share one clock. The dock rides the keyboard
height from `useKeyboardAnimation`, which updates continuously. The
sheet unmounts from the exit animation's completion callback instead of
a timer.

A failed write shows a toast above the bar with Retry, which re-runs the
same draft. The sheet does not reopen, and the draft is never lost.

## Consequences

The interaction feels instant because nothing on the screen waits for
disk or a provider. The row exists before its file does, which the store
already handles with a provisional id.

A failure now arrives after the sheet has closed, so the toast has to carry
the message. That is why it lives in the bar, which both tabs render,
instead of inside the sheet.

## Alternatives

**Keep the sheet open until the write lands.** Honest about failure, but
it puts disk latency in front of the user, which is the complaint.

**Optimistic row with a spinner in the sheet.** The spinner still ties
the sheet's life to the write. The user also sees a progress state for
something that should not be visible at all.

## Amendment, 2026-10-26: one clock in fact

The decision stands: the tap closes the sheet, and the write runs
behind it. The claim of one clock did not hold. The keyboard moved on
a native value with the system's curve. The sheet and the bar ran a
220 ms timing on the JS driver. Ticket 0062 rides the keyboard on the
UI thread with `useReanimatedKeyboardAnimation`. The sheet follows the
keyboard's progress while the keyboard moves (ADR 0036).
