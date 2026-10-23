---
id: 0032
title: The editor appends to the body instead of replacing it
created: 2026-10-23
priority: high
assignee:
pr:
depends: [0013]
---

## Spec

Reported on the phone on 2026-10-23. A task note with an empty body,
edited to add `1234`, came back from Obsidian as:

```
---
...frontmatter...
---
12344in]]
---
```

The body was not replaced cleanly: text from the frontmatter tail and a
closing fence landed after it. This is a data corruption bug in
`features/task-editor/save.ts`, in `replaceBody` or in the order the
property writers run before it.

Reproduce with the reported note text before changing anything. The
fix must keep unknown frontmatter byte for byte and leave the body
exactly as typed.

## Acceptance

- [ ] Saving a body replaces the old body and nothing else.
- [ ] A note whose frontmatter ends at end of file round trips.
- [ ] Unknown properties survive the save unchanged.
- [ ] A second save of the same note is a no-op on the body.

## Outcome

(filled in before moving to done/)
