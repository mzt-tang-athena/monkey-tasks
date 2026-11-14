---
title: Alert weight in the editor
created: 2026-11-11
priority: normal
assignee:
pr:
depends: ["20261111-alert-weight-schema"]
---

## Spec

Let the operator set the weight from the app. The parent decision lives in
`20261111-reminder-weight.md`; read it first.

The editor goes through `app/src/features/task-editor/` and writes through
`app/src/lib/vault/save-task-edit.ts`. The edit type is `TaskEdit` in
`app/src/types/task.ts`.

Build:

1. A two state control, `Harsh` and `Quiet`. One sentence under it says what
   changes: `Harsh rings on the alarm stream. Quiet is silent.`
   Keep the words on screen the same as the vault values.
2. The control starts at the note's value, and absent shows `Harsh`.
3. On save, write `alert weight: quiet` for a cue and remove the key for a
   need, so only cues carry the line. Use `updateProperty` in
   `app/src/lib/vault/frontmatter.ts`, which already handles spaced keys.
4. Add `alertWeight` to `TaskEdit` and the dirty check, so the save button
   reacts to a change of weight. Keep the existing edit path and the single
   write per save.
5. If ticket 0093 has rebuilt the editor before this ticket starts, add the
   control to the rebuilt form instead. Never keep two editors.
6. No marker on the row, no filter, no sort. The weight is delivery only.

## Acceptance

- [ ] The editor shows the current weight, with absent shown as Harsh.
- [ ] Saving Quiet writes `alert weight: quiet` once, in place.
- [ ] Saving Harsh removes the key and changes nothing else in the file.
- [ ] A save with no change to the weight leaves the frontmatter untouched.
- [ ] Lint, typecheck and the editor tests pass.

## Outcome

(filled in before moving to done/)
