#!/usr/bin/env bash
# Run an emulator script under both locks, heavy first and then the
# emulator lock, in its own capped unit. The emulator it starts outlives
# the unit, so a later pass reuses it. android-launch.sh starts the idle
# watcher, so an emulator nobody uses stops itself.
# Usage: heavy-emulator.sh <script> [args...] [--background]
. "$(dirname "$0")/heavy.sh" emulator --keep-child "$@" || exit 1
if [ $# -eq 0 ]; then
    echo "usage: heavy-emulator.sh <script> [args...] [--background]" >&2
    exit 2
fi
exec flock -o /tmp/monkey-tasks-emulator.lock "$@"
