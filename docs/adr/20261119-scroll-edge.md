# A header carries a hairline where its content scrolls under it

- **Status:** accepted
- **Date:** 2026-11-19

## Context

Three screens put content under a fixed header.
The day's timeline scrolls its hours under the TIMELINE label.
The Inbox grid starts under the Inbox Notes title.
The Settings sections start under the Back row.

An audit of the 1.0 screenshots found no edge at any of them.
Content met the header with no line, so a scroll looked unfinished.
Two more spots came up in the same audit.
The Lists rows meet the tab strip, and the Journal page meets the
month band. The operator left both alone: each already has its own
rule.

The operator picked a line for the other three.
The timeline shows one only once hours pass under it, so a day at its
top stays clean.
The Inbox and Settings show theirs always.

## Decision

One piece draws every line, `ScrollEdge` in
`src/components/motion/scroll-edge.tsx`.
It paints the palette's `hairline` colour at `StyleSheet.hairlineWidth`
and takes no press.
The parent places it over the first row of the scroller's box, which
is where a scroll cuts the content.

With an `offset`, the line follows the scroller.
`MotionScrollView` writes that offset on the UI thread through
Reanimated's `useScrollOffset`, and the line fades in once content
passes the top.
No frame re-renders the screen.
`ReduceMotion.System` lands the fade at once, so the line just appears.

Without an `offset`, the line always shows.
The swipe preview's still copy passes `shown` so its line matches the
page it draws.

The line costs a gap on Settings.
Its content gains 12pt of top padding, so the title does not touch the
rule.

## Consequences

The three edges share one look, and a fourth screen adds one line.
A screen that follows its scroll passes a `useScrollEdgeOffset()` value
to the scroller and the edge. It writes no worklet (ADR 0046).

The rule draws on the scroller's top edge, not on the header's own
bottom padding.
A header with space under its text keeps that space above the rule.
The line then lands where a scroll cuts the content.

A scroll writes one shared value per frame on the UI thread.
The line reads it in an animated style, so the React tree stays still.
