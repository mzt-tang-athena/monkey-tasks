---
title: The list tab underline follows the swipe
created: 2026-11-18
priority: normal
assignee: omp
pr: 169
depends: []
---

## Spec

The Lists tab strip paints one 2 px rule under the selected list.
Today the rule moves only when the pager commits a new tab.
A swipe between lists leaves the rule behind until the swipe lands.
Google Tasks keeps the rule under the finger.
Halfway between two lists the rule sits halfway between their tabs.
Its width blends from one tab width to the next.

Drive the rule from the pager's live page position, on the UI thread.
The pager already keeps that position in a shared value.
No React re-render per frame and no JS-thread animation.

Tap to switch still animates the rule to the tapped tab.
A jump of more than one page cuts the page.
The rule then crosses to its new tab on its own clock.
Reduced motion jumps the rule with no slide.
TalkBack keeps its selected tab.
The strip keeps scrolling the selected tab into view.

## Acceptance

- [x] A half swipe leaves the rule between the two tabs.
- [x] The rule's width sits between the two tab widths.
- [x] The rule settles with the page on release.
- [x] A tap one page away slides the rule.
- [x] A tap three pages away crosses the rule.
- [x] Reduced motion jumps the rule with no slide.
- [x] The selected tab keeps `aria-selected`.
- [x] No re-render per frame: shared values move the rule.
- [x] The full web suite passes.
- [x] The Android frames proof shows the rule moving.

## Outcome

The rule now reads one `PageFollow` link that the pager owns.
It moves on the UI thread, with no React re-render per frame.

- Web, half swipe: rule 63/49, between Main and Errands.
- Before, half swipe: rule stayed at 32 under Main.
- Release: rule lands under Errands at 60/64.
- Android frames: rule walks 21 to 48, width 24 to 32.
- Motion off: rule jumps in one frame and holds.
- Tap three pages away: rule crosses in 220 ms.
- Reduced motion: the rule jumps with no slide.
- ADR 0046 has a dated amendment.
- PR #169. Evidence in `app/build/verify/evidence/`.
