# 0038. Tests render through React Native Web

- **Status:** accepted
- **Date:** 2026-10-26

## Context

The app has 261 tests in 30 files. They run on Vitest in node, in about
2 s. Logic tests import plain modules. Six component tests render with
`react-test-renderer` and replace `react-native` with hand-written
stand-ins (`src/test/rn-standin.ts` and inline `vi.mock` blocks). A
stand-in keeps the props and nothing else. A test "taps" by calling
`props.onPress()` and finds a node by its type name. These tests check
our wiring against our own copy of React Native, not against React
Native.

The app has no end-to-end test. The rebuild (0047) rewrites the data
layer, splits every screen, and moves every gesture to Reanimated and
RNGH. We need tests that render real components, and a suite that
drives the running app through those rewrites.

React 19 deprecates `react-test-renderer`. React Native's entry file is
Flow source, so node cannot import it. Plain Vitest cannot load React
Native at all.

A probe on 2026-10-26 tried both layers:

- `TaskRow.tsx` rendered through React Native Web 0.21 in jsdom with
  React 19.3, in 173 ms. Role and label queries found its buttons, and a
  click reached `onToggle` and `onOpen`.
- Playwright drove the web preview through ten user flows: tick,
  capture, list swipe, reorder, day swipe, month swipe, drag to
  schedule, editor save and reduced motion.

## Decision

Component tests render through React Native Web in jsdom with
`@testing-library/react`. They run in a Vitest project named
`component`, where `react-native` resolves to `react-native-web`. Logic
tests stay in a node project named `unit`.

End-to-end tests run in Playwright against the exported web build.
Both layers find elements the same way: by role, by accessible name,
and by `testID`, which React Native Web writes as `data-testid`.

Maestro flows on an Android emulator come later, in 0064.

## Consequences

One runner serves unit and component tests, and the suite stays fast. A
component test renders real React Native Web views, so a tap runs the
real press handling. The stand-ins go away.

`Platform.OS` is `web` in every component test. Those tests take the web
branch wherever the code splits by platform. The Android branches get no
render coverage: the responder swipe in `src/lib/swipe.ts`, the RNGH
drag handles, and the native settings store. Logic tests cover their
pure parts. Maestro (0064) covers them on a device.

A test can only assert what reaches the DOM. React Native Web drops the
`accessibilityState` prop, so selected and checked states must use
`aria-*` props. That change also fixes those states for screen readers on
web.

jsdom lays out nothing, so component tests do not test gestures.
Gestures belong to Playwright, which sends real pointer events.

Web and Android share a selector vocabulary. A `testID` serves the
component test, the Playwright spec and the Maestro flow.

## Alternatives

**Jest with `jest-expo` and React Native Testing Library.** It renders
React Native's own components with native modules mocked, and it can run
the Android branches. It needs a second runner beside Vitest, a Babel
setup, and `jest` APIs in place of `vi`. The test suite would split
across two configs.

**React Native Testing Library under Vitest.** It needs React Native
itself in node. React Native ships Flow source. The Vitest adapter for
React Native (`vitest-react-native` 0.1.5) has had no release since
January 2024.

**Keep the stand-ins.** They test our wiring against props we choose. A
change in React Native or in our own handlers passes them unseen.

## Amendment, 2026-10-28: a test id marks the live copy only

Ticket 0049 added the Playwright suite. A pager draws a still copy of
the next page while a swipe travels, and keeps it for 250 ms after the
page lands. The list drag draws a ghost of the lifted row. Each copy
holds the same rows as the live page. Playwright fails at once when a
locator matches two elements. It does not wait for the copy to go.

So a `testID` marks the live element only, and a copy carries none.
`TaskRow` and `TaskListSection` take a `copy` prop for this. The day
preview and the drag ghost set it. `Timeline` takes its id prefix as a
prop, and only the live day passes one. `MonthGrid` sets `month-title`
only on the interactive month. A spec then finds one element at every
moment of a gesture.

We rejected two other ways. `aria-hidden` on the copies hides them from
role queries but not from `getByTestId`. A spec that scopes each query
to the live page would have to know how each pager is built, and
ticket 0059 rebuilds every pager.
