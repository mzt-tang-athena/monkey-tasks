# 0003. Offline first, no dedicated backend

- **Status:** accepted
- **Date:** 2026-10-17

## Context

Email and calendar integrations and agent capture need an always-on
machine. athena fills that role. The concern was coupling the app to
athena's uptime. A custom backend would live on athena anyway, so a
controller and API layer would buy nothing today.

## Decision

The app is offline first and has no dedicated backend. The vault folder on
the device is the working truth. athena stays an integration layer that
writes results into the vault as notes; agents reach the data through a
future MCP server there.

## Consequences

Tasks, alarms, and triggers work with athena down. Integrations pause when
athena is down and catch up later. The rule of thumb: a feature that must
run at 3 am lives on athena; a feature that must work when athena is dead
lives in the app.
