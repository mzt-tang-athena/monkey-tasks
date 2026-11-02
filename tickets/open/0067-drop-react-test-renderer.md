---
id: 0067
title: Drop react-test-renderer
created: 2026-10-27
priority: normal
assignee:
pr:
depends: [0052]
---

## Spec

React 19 deprecates `react-test-renderer` (ADR 0038). Ticket 0048 moved
the five screen tests to Testing Library. Five test files still render
with `react-test-renderer`:

- `src/store/tasks.test.tsx` and `src/testing/repro/store-races.test.tsx`.
  Ticket 0052 rewrites both against the mutation hooks.
- `src/features/capture/hooks/useCaptureDraft.test.ts`,
  `src/features/planner/hooks/usePlannerMonth.test.ts` and
  `src/features/planner/hooks/usePlannerRoute.test.ts`. No ticket owns
  these. Each one mounts a `Probe` component that reads the hook result
  through a module binding.

### Work

1. Move the three hook tests to `renderHook` from
   `@testing-library/react`. `renderHook` needs a DOM, so the tests run
   in the `component` project. Rename them to `.test.tsx`, or widen the
   project's include list. Drop the `Probe` components and their
   `react-hooks/globals` disables.
2. Once 0052 has rewritten the two store tests, no file imports
   `react-test-renderer`. Remove it from `app/package.json`.

## Acceptance

- [ ] No test imports `react-test-renderer`.
- [ ] `react-test-renderer` is gone from `app/package.json`.
- [ ] The three hook tests use `renderHook` and pass in the `component` project.

## Outcome
(filled in before moving to done/)
