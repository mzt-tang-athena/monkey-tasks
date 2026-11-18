# An Inbox title breaks only at its hyphens

- **Status:** accepted
- **Date:** 2026-11-18

## Context

A card's title is the note's file name. Long names broke mid-word on
Android. The card showed `20261023-flight-email-t` then `racker`, and
`20261022-indented-pas` then `te`. Android's default breaker fills the
line to its last fitting character when one run is wider than the card.
It ignores the hyphens inside that run.

The browser already breaks after a hyphen, so the web preview looked
right and the phone did not.

## Decision

Split the title at each hyphen and draw each run as its own text box in
a wrapping row. Each box boundary is a place a line may break, so a
line ends after a hyphen. A run wider than the card still wraps inside
itself. The runs join back to the exact name. The card adds, removes
and reorders no character.

## Consequences

A line never breaks at a stray letter. The one exception is a run wider
than the card, which is the operator's rule.

The title no longer stops at three lines. A clamp cannot span separate
text boxes, and cutting a name to fit hides the part that names the
file. A long name now makes a taller card.

The other fix was a zero-width space after each hyphen. It keeps the
clamp but puts a character in the name, and the name stays as written.
