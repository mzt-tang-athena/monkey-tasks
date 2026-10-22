# 0016. Stay on React Native and Expo

- **Status:** accepted
- **Date:** 2026-10-22

## Context

We designed the UI against mock data in the browser, then ported it to
native. The design work lived on `design-final`, while `main` held an
older foundation. The branches are now consolidated. The port carried
web-only assumptions: pointer events, DOM checks, and window layout.
Some of those assumptions failed on Android. A Capacitor or web wrapper
rewrite was considered as a way to keep one code path.

## Decision

We stay on React Native and Expo. We reject a Capacitor or web wrapper
rewrite. The failures came from assumptions in the port, not from the
stack. We fix them with device verification.

## Consequences

Native modules stay first-class: SAF vault access, notifications, and
gestures. Each screen is verified on a device before we call it done.
The browser build stays a preview only, so a feature that works on web
is not done. We keep one native code path and no second wrapper layer.
