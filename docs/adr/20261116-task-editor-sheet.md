# The task editor is a sheet, with instant save and an Undo

- **Status:** accepted
- **Date:** 2026-11-16

## Context

The task editor was a full-screen route with six text fields. It asked
for ISO dates, an RRULE string and a newline list of names. It had one
Save button. A failed save kept the user on the screen.

The operator named Todoist's task sheet as the reference. They asked
for a bottom sheet with pickers, and a write on each change. They also
asked for no raw syntax on the main path (ticket 0093).

A task has one note file. A rename writes a new file under SAF. Writes
can fail, and another app can change the file between a read and a
write (ADR 0017, ADR 0037).

## Decision

The editor is a bottom sheet over the screen that shows the task. The
sheet holds the list picker and the title. A property with a value
shows as a tile. One without shows as a chip in the add strip. A
picker is a second sheet stacked over it.

Each committed change writes at once through the edit mutation. The
session lives in a provider above the stack, with one write in flight
per task. A change made while a write runs waits. Only the latest
draft goes next. A failure keeps the draft on screen and shows "Not
saved." with Retry. Retry writes the draft against the latest text the
store holds. The title writes on blur, on submit and on close, because
a rename writes a new file.

Delete removes the note and shows a toast with Undo for five seconds.
Undo writes the exact text the file held back to the same path.

We rejected the route. It hides the list behind it, and it cannot hold
a stacked picker without a second route.

We rejected a Save button. Every change is small, and a Save button
loses the change when the app closes.

We rejected a write per keystroke. A rename writes a new file under
SAF, so the title writes only when the user leaves the field.

We rejected a trash folder. The vault has no trash, and a folder adds
a second place a task can live. The toast holds the text for five
seconds, and after that the delete is permanent.

## Consequences

The sheet keeps the list visible, and a change costs one tap. The
editor never shows an ISO date or an RRULE string in the main path.
Recurrence keeps one advanced field, and it previews the next three
dates in plain words.

A write can fail after the sheet closes. The sheet shows the failed row
when it opens again. A delete waits for the write in flight, so a
rename cannot leave a stale file.

The session reducer and its queue are pure and tested. Reference
(ticket 0091) and alert weight join the property registry as one more
entry each.

## Amendment 2026-11-16: alert weight joins the Alerts picker

Main shipped the alert weight while this editor was on its branch.
The old full-screen editor held its control.
This branch removes that editor, so the control moved here.

The Alerts picker shows a Harsh and Quiet control under the reminders.
The weight covers the timed due and every reminder, so it shows once.
A change writes at once, like every other property.
The Alerts tile adds "Quiet" when the task is quiet.
It adds nothing for harsh, the default.

We kept the weight inside the Alerts picker.
A tile or chip of its own was the alternative.
That would show a weight on a task with no alert, where it does nothing.

## Amendment 2026-11-17: a drag down closes the sheet

Ticket 0093 promised that a drag down closes the sheet.
The shared sheet did not have that drag. It does now.

A new surface, `SheetDrag`, moves the panel with the finger.
A surface is a shared motion component in `src/components/motion` (ADR 0046).
The panel moves on the UI thread, the thread that draws frames (ADR 0036).

A drag starts only on a grab area.
The sheet draws a small handle in its top padding.
The editor, each picker and the note editor make their header row a grab area too.
A tap on a control in the header still presses it.

A release past 80 px closes the sheet.
A downward flick faster than 500 px a second also closes it.
Both numbers match the page swipe.
Any other release springs the panel back.
An upward drag stretches at most 48 px, then returns.

We rejected a drag from anywhere on the panel.
The editor body scrolls up and down.
The title is a text field, where a drag selects text.
The chip strip scrolls sideways.
Each one would have to hand the drag to the sheet at the right moment.
The browser preview cannot test that hand-over, so a fault would first show on the phone.
A handle and a header hold nothing that scrolls, so they need no hand-over.
The cost: a drag on the body scrolls the body and never closes the sheet.

Every sheet gets the drag, with no opt-in.
The capture sheet has no header, so only its handle grabs.
Its panel moves inside the keyboard lift, so the drag and the keyboard never share one style.
A drag on a stacked picker closes only that picker.

With reduced motion the panel still follows the finger.
The spring back and the slide out then land at once.
Screen readers skip the handle.
The scrim button and Android back stay as the accessible ways to close.
