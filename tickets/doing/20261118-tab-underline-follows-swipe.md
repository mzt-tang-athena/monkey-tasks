---
title: The list tab underline follows the swipe
created: 2026-11-18
priority: normal
assignee: omp
pr:
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

- [ ] A half swipe leaves the rule between the two tabs.
- [ ] The rule's width sits between the two tab widths.
- [ ] The rule settles with the page on release.
- [ ] A tap one page away slides the rule.
- [ ] A tap three pages away crosses the rule.
- [ ] Reduced motion jumps the rule with no slide.
- [ ] The selected tab keeps `aria-selected`.
- [ ] No re-render per frame: shared values move the rule.
- [ ] The full web suite passes.
- [ ] The Android frames proof shows the rule moving.

## Outcome

(filled in before moving to done/)
