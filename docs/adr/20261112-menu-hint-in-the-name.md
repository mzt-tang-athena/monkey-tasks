# A hinted menu item reads as one name

- **Status:** accepted
- **Date:** 2026-11-12

## Context

`Menu` named each item with its label alone. The row also drew the hint,
on a second line under the label. WCAG 2.5.3 (Label in Name) asks the
accessible name to hold the visible text. Axe reports
`label-content-name-mismatch` when it does not. The gallery found this
with a hinted item in its menu. `CommandPane` already joins the two
words in a row's name and passes.

The label and the hint are separate blocks. The document joins their
text with nothing between them, so it reads "Move to listPick a list".
The name has a space. Axe compares the two word by word, so a missing
space fails even when the name holds every word.

## Decision

`Menu` names an item `` `${label} ${hint}` `` when it has a hint, the
same way `CommandPane` names a row. The label text carries a trailing
space, so the document's text and the name hold the same words.

A trailing space hangs at the end of a line and moves nothing. We
measured the row at 412 wide, and the label, the hint and the menu
height stayed the same. A leading space on the hint also passes, but it
pushes the hint about 3 px right, which changes the layout.

We rejected a name with no space. It would match the document's text,
but a screen reader then says "Move to listPick a list".

We also tried hiding the hint from assistive tech with `aria-hidden` and
naming the item by its label. Axe still reports the mismatch at serious
impact, and a screen reader user would lose text the row shows. So that
path does not work.

## Consequences

Every hinted menu item reads as one name, and a new caller gets that
for free.

The trailing space looks odd in the source, and a reader may delete it.
A comment in `MenuRow` says why it stays. Removing it brings the axe
failure back, and the gallery spec fails on that scan.
