---
id: 0047
title: Bulletproof refactor and motion rebuild
created: 2026-10-26
priority: high
assignee: claude-code
pr:
depends: []
---

## Spec

A full audit on 2026-10-26 found four problems. The app does not follow
Bulletproof React, which ADR 0001 chose. The data layer loses rows and
rings alarms twice in normal use. The motion code runs on the JS thread
and sequences itself with timers, which causes most of the glitches seen
on the phone. And there is no end-to-end test, so none of this shows up
before a phone pass.

This epic fixes all four. Each child ticket is one PR. Every bug fix
starts with a test that reproduces the bug.

The work lands on one integration branch, `epic/0047-rebuild` (ADR
0035). Child PRs squash into it. One final PR takes it to main after a
phone pass on a dev client built from the branch.

Phases, in order. A later phase builds on the homes an earlier one made.

| Phase | Tickets | What it does |
|---|---|---|
| 0. Safety net | 0048, 0049 | Vitest projects, component tests through react-native-web, lint baseline, Playwright on the web build |
| 1. Layout | 0050 | `@/` alias, shared types, `lib/vault`, `stores/tasks`, kebab-case names, import boundaries at warn |
| 2. Data | 0051, 0052, 0053, 0066 | Vault adapter with SAF and memory adapters, writes as `useMutation` hooks, parser fixes in contracts, month-end recurrence |
| 3. Screens | 0054, 0055, 0056, 0057 | Shared UI primitives, the Lists screen out of its route, the planner split, the capture dock and editor split |
| 4. Motion | 0058, 0059, 0060, 0061, 0062 | Reanimated 4 and gesture handler 3 on the UI thread, then each surface ported |
| 5. Access | 0063 | Labels, roles, states and touch targets |

Later, outside this epic: 0064 (Maestro on Android), 0065 (the list
menu actions) and 0067 (drop `react-test-renderer`, after 0052).

The decisions live in ADRs 0035 to 0039.

Agents work in one git worktree per ticket, so parallel tickets never
share a checkout. Tickets that touch the same files run one after the
other.

## Acceptance

- [ ] Every child ticket from 0048 to 0063, and 0066, is in `done/`.
- [ ] Typecheck, lint with no warnings, Vitest and Playwright pass on the
      branch.
- [ ] The import boundary rule runs at error with no violations.
- [ ] A dev client built from the branch passes a phone pass with reduce
      motion on and off.
- [ ] The final PR to main merges with each child commit kept.

## Outcome

(filled in before moving to done/)
