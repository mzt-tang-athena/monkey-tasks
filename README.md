# project-template

Skeleton for new mzt-tang-athena projects. Create a repo with
"Use this template", rename the title lines, and start.

## What is inside

- `AGENTS.md` - rules for agents: PR flow, tickets, ADRs
- `PLAN.md` - what the project is and what comes next
- `docs/adr/` - decision record; copy `adr-template.md` per decision
- `tickets/` - the work queue; the rules live in `tickets/README.md`
- `.github/workflows/ci.yml` - prose lint for README, PLAN, and ADRs
- `.vale.ini` and `.vale/styles/` - the writing rules

## Conventions

Decisions with trade-offs get an ADR the same day. All work starts as a
ticket. Agent rules enforce both, not tooling. When a rule keeps getting
missed, add a CI check for it then.
