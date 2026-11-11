# Planner

The Planner tab shows the tasks by time in day, week or month mode. Day
mode splits into an hour timeline and a day list with a grabber between
them. The user drags a task onto an hour, a week column or a month cell
to schedule it, and swipes to move between days or months.

## Sub-features

- `planner-modes` switches Day, Week and Month from the segmented control.
- `planner-day` shows the timeline, the overdue group, the now line and the day list.
- `planner-swipe` turns the day or the month with a swipe.
- `planner-drag` schedules a task by a hold and drag onto an hour, a week column or a month cell.
- `planner-split` resizes the timeline with the `resize timeline` grabber.

## How to get to it (user POV)

- Tap `Planner` in the bottom bar, or open `/planner`.
- Tap `Day`, `Week` or `Month` at the top.

## Driving it with Playwright

Preconditions: a fresh page on `/planner`, Day mode, today is Monday 26.

- **Swipe day.** `swipe(page, getByTestId("day-pager"), "left", "page")`. `getByTestId("day-heading")` reads `Tuesday 27`.
- **Drop on an hour.** `holdDrag(page, row(page, overdue.name), getByTestId("timeline-hour:10"), { holdMs: 450 })`. The hour shows the task at `10:00 AM`, and the day list row loses `overdue`.
- **Week drop.** Click the `Week` tab, then hold and drag a list row onto a day column. The task takes that day.
- **Month.** Click `Month`, then `swipe(page, getByTestId("month-pager"), "left", "page")`. `month-title` reads `November 2026`.
- **Split.** Drag `resize timeline` up and down. The source toggle stays above the bottom bar.
- **Proof.** Screenshot before and after each drop, and attach the note text of the moved task.

## Gotchas

- The split paints at 320 px for one frame before layout reports, then settles. Wait for the settled layout before you measure (ticket 0061).
- A hold shorter than the long-press time scrolls instead of lifting. Use `holdMs: 450` or more.
- The web runs a second drag path on pointer events today. Ticket 0061 deletes it, so a web drag passing does not prove the native drag works.
