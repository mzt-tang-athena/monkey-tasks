---
id: 0067
title: Drop react-test-renderer
created: 2026-10-27
priority: normal
assignee: claude-code
pr: 83
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

- [x] No test imports `react-test-renderer`.
- [x] `app/package.json` no longer lists `react-test-renderer`.
- [x] The three hook tests use `renderHook` and pass in the `component` project.

## Outcome
Four changes landed.

- The three hook tests use `renderHook` and moved to `.test.tsx`. The
  `Probe` components and their `react-hooks/globals` disables no longer
  exist.
- Ticket 0052 had left `react-test-renderer` in the two store tests. They
  now render with Testing Library's `render`. The Probe pattern and its
  lint disable stay, because the store tests read more than one hook
  through one probe.
- The store tests moved from the `unit` project to the `component`
  project. The include and exclude lists in `vitest.config.mts` lost
  their store entries.
- `react-test-renderer` is out of `app/package.json`. ADR 0038 has a
  dated amendment.

No leftover work remains. `@types/react-test-renderer` stays in the lockfile,
because `react-native-gesture-handler` depends on it.
