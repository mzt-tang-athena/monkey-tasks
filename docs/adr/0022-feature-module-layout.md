# 0022. Feature module layout

- **Status:** accepted
- **Date:** 2026-10-22

## Context

The planner route had grown to 3,376 lines: a screen, eleven components,
a stylesheet and domain helpers in one file. The capture sheet lived
inside an 807-line bottom bar. The task store exposed one context value,
so every consumer re-rendered on every tick. A review against the
Bulletproof React practices scored the project at PASS 3, PARTIAL 11,
FAIL 5.

## Decision

Routes stay thin. A route file re-exports its screen.

- `app/src/features/<name>/` owns a feature: `model.ts` for pure rules,
  `components/` for its UI, `hooks/` for its stateful glue, `lib/` for
  pure helpers that are not the model.
- `app/src/components/` holds cross-feature UI. `components/ui/` holds
  primitives with no feature knowledge.
- `app/src/store/` holds state, actions and selectors in separate
  modules. Components read `useTaskList`, `useStoreMeta` or
  `useTaskActions`, so an action-only consumer does not re-render when a
  task changes.
- `app/src/lib/` holds shared code with no feature knowledge (ADR 0020).

The planner mode and day live in the route parameters, so a planner
view is addressable and survives a remount.

## Consequences

The planner container is 639 lines and holds only state and composition.
The capture sheet is its own component with a `useCaptureDraft` hook.
Lists and the planner render through virtualized lists.

Presentational components are copied with their styles and verified by
type check, tests and a manual parity pass. There is no render test for
each one, and the manual pass is the only check that they look the same.

## Alternatives

**Keep the single file and split only the domain.** The model already
moved out (ADR 0017's follow-up). The UI would still be one module and
one reviewer would still hold 3,000 lines in their head.

**A component library.** A third-party kit would replace the app's
design language. The three primitives the app reuses now live in
`components/ui`.
