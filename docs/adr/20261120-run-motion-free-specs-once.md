# Run motion-free specs once

- **Status:** accepted
- **Date:** 2026-11-20

## Context

The web suite ran every spec in two projects. One project played the
animations. The other asked the browser for reduced motion. On
2026-11-20 that took 696 runs. A full run holds the heavy lock, and
every lane waits for it.

The run's own work sets the wall time. The tests summed to 2083
seconds. Two workers turn that sum into 1041 seconds. That accounts
for 96 percent of the 1086 seconds the run took. The export and the
web server do not limit it. The run count does.

Most specs read names, notes, colors or axe results. Reduce motion
changes none of those. The second run proved nothing.

## Decision

`app/e2e/motion.ts` marks every spec `both` or `once`, with the
reason. Some specs check a transition, a spring, a frame or the
absence of one. Those are `both`, because the reduced-motion project
is the other half of the check. The rest are `once` and run in the
`motion` project.

The `reduced-motion` project skips the `once` specs by file name. The
suite stops before it starts in two cases. A spec has no mark, or a
mark names no spec.

The mark lives in one file beside the config, because the config reads
it. A copy in each spec would drift. All 30 decisions fit on one
screen.

## Consequences

17 of the 30 specs run once. The suite went from 696 runs to 521. It
went from 18.1 to 12.9 minutes on this host with 2 workers. A run
gives back 5.2 minutes of the heavy lock. We deleted no test and
raised no timeout.

The 17 lose a second look under reduced motion. Their assertions read
end states. Reduce motion does not change an end state. A spec that
starts to check motion moves to `both`. The ticket that adds the check
pays for the second run.

A new spec fails the run until someone marks it. A journey still runs
in both projects until someone marks it too.

The 13 specs that still run twice are the slowest. `planner-drag`,
`pagers` and `reorder` hold most of the rest.
