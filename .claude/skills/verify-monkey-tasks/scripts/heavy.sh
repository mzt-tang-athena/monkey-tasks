#!/usr/bin/env bash
# Heavy-job prelude. Source it first thing in a script that hogs this
# 15 GB host:
#
#   . "$(dirname "$0")/heavy.sh" <slug> [--keep-child] "$@"
#
# The script then runs again in its own transient unit, capped at 8G so a
# runaway build dies alone, and queued on the heavy lock so one heavy job
# runs at a time. From a shell it waits and returns the job's exit code.
# --background starts the unit and returns at once with its name.
# --keep-child lets the job leave processes behind, which the emulator
# needs. MONKEY_HEAVY_LOCK=1 says a caller holds the lock already, so this
# runs in place. The caller's exported variables and directory reach the
# unit, so CLEAN, ARCHS and MONKEY_LOG_DIR still apply.
#
# Sourcing matters: the branch that runs in place must return to the body.

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    echo "heavy: source this file, do not run it" >&2
    exit 2
fi

heavy_slug=${1:-}
case $heavy_slug in
    "" | -*)
        echo "heavy: usage: source heavy.sh <slug> [--keep-child] <args>" >&2
        exit 2
        ;;
esac
shift

heavy_keep=0
if [ "${1:-}" = --keep-child ]; then
    heavy_keep=1
    shift
fi

heavy_self=$(realpath "$0") || exit 1
heavy_lock=/tmp/monkey-tasks-heavy.lock
heavy_cap=${MONKEY_HEAVY_CAP:-8G}

if [ -n "${MONKEY_HEAVY_LOCK:-}" ]; then
    return 0
fi

if [ -n "${MONKEY_HEAVY_UNIT:-}" ]; then
    exec env MONKEY_HEAVY_LOCK=1 flock -o "$heavy_lock" "$heavy_self" "$@"
fi

heavy_background=0
heavy_args=()
for heavy_arg in "$@"; do
    if [ "$heavy_arg" = --background ]; then
        heavy_background=1
    else
        heavy_args+=("$heavy_arg")
    fi
done

# Forwarding the caller's environment keeps every knob the scripts read.
# The lock flags and the shell's own bookkeeping stay out of it.
heavy_env=()
while IFS= read -r -d '' heavy_entry; do
    heavy_name=${heavy_entry%%=*}
    case $heavy_name in
        MONKEY_HEAVY_LOCK | MONKEY_HEAVY_UNIT | PWD | OLDPWD | SHLVL | _) continue ;;
    esac
    [[ $heavy_name =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    heavy_env+=("--setenv=$heavy_entry")
done < <(env -0)

heavy_unit=heavy-$heavy_slug-$(date +%Y%m%d-%H%M%S)-$(printf '%04x' "$RANDOM")
heavy_run=(systemd-run --user --quiet --unit="$heavy_unit" --collect
    -p MemoryMax="$heavy_cap" --working-directory="$PWD"
    "${heavy_env[@]}" --setenv=MONKEY_HEAVY_UNIT=1)
if [ "$heavy_keep" = 1 ]; then
    heavy_run+=(-p KillMode=process)
fi
if [ "$heavy_background" = 0 ]; then
    heavy_run+=(--pipe)
fi
heavy_run+=(-- "$heavy_self" "${heavy_args[@]}")

printf 'unit: %s (MemoryMax=%s)\n' "$heavy_unit" "$heavy_cap"

if [ "$heavy_background" = 1 ]; then
    "${heavy_run[@]}" || exit 1
    printf 'follow: journalctl --user -u %s -f\n' "$heavy_unit"
    exit 0
fi

if "${heavy_run[@]}"; then
    heavy_rc=0
else
    heavy_rc=$?
fi
printf 'unit %s exit %s\n' "$heavy_unit" "$heavy_rc"
exit "$heavy_rc"
