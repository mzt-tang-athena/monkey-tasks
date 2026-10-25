---
id: 0042
title: The type scale sits small under the taller bar
created: 2026-10-25
priority: normal
assignee: omp
pr: 60
depends: [0038]
---

## Spec

Reported on the phone after 0038. The bar reads as the strongest thing
on the screen: a 72pt bar with a 48pt control over a 16pt row title,
11pt group labels and a 16pt tab strip.

A Hallmark audit of the Lists screen found two tells. The type scale is
increments, not a ratio: 11, 12, 13, 14, 15 and 16 all appear on one
screen. And the chrome outweighs the content, so the eye lands on the
bar first.

The fix moves the content up one step and the bar down one. The row
title and the tab strip go to 17 on a 24 line, the group labels to 12
on a 16 line, and the bar's row to 52. The Add control stays 48 and
every control stays at least 44, per 0038.

## Acceptance

- [ ] The row title and the tab strip are 17pt on a 24pt line.
- [ ] The group labels are 12pt on a 16pt line.
- [ ] The bar's row is 52pt. The Add control stays at least 48 and
      every control stays at least 44.
- [ ] The bar still fits one row at 320px.
- [ ] The sizes come from tokens where 0038 put them.

## Outcome

The row title and the tab strip are 17pt on a 24pt line. The group
labels are 12pt on a 16pt line with 1pt tracking. The bar's row is
52pt, so the bar totals 68pt plus the system inset. The Add control
stays 87 by 48 and each nav item 56 by 44.

Hallmark's rule that decided it: size steps should be a ratio, not
increments. The screen held 11, 12, 13, 14, 15 and 16 at once, and
the chrome outweighed the content. One step up for the content and
one step down for the bar fixes the balance without a retype.

Verified in the web preview: measured 17pt for the row title and the
tab strip, 48pt for the Add control, 44pt for the nav items, and one
row at 320px.
