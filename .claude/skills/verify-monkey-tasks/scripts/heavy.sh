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
# The values travel in a file, never in an argv. /proc/PID/cmdline is world
# readable and --pipe keeps systemd-run alive for the whole job, so
# --setenv left every value on show for the run's length. Each line of the
# file is NAME="value" with backslash and quote escaped. systemd reads
# every other byte as written, a newline included, and drops none of them,
# since a value holds no NUL. The unit unlinks the file before the job's
# first line. A process of the same user can still read the job's
# /proc/PID/environ, which no forwarding avoids.
#
# A caller that wraps the whole job in its own flock also holds the lock,
# and the unit's flock would then wait on that same caller forever. The
# ancestry check below spots that holder before the unit starts and runs
# the job in place instead. MONKEY_HEAVY_LOCK_FILE points the lock at
# another file, which the tests use.
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
heavy_lock=${MONKEY_HEAVY_LOCK_FILE:-/tmp/monkey-tasks-heavy.lock}
heavy_cap=${MONKEY_HEAVY_CAP:-8G}

if [ -n "${MONKEY_HEAVY_LOCK:-}" ]; then
    return 0
fi

if [ -n "${MONKEY_HEAVY_UNIT:-}" ]; then
    exec env MONKEY_HEAVY_LOCK=1 flock -o "$heavy_lock" "$heavy_self" "$@"
fi

# Print the pid of an ancestor of this shell that holds the heavy lock,
# or nothing. lslocks reads /proc/locks, so it names the holder without
# taking the lock itself, and it ships with flock's own package.
heavy_ancestor_holder() {
    local holder ancestor
    [ -e "$heavy_lock" ] || return 0
    while read -r holder; do
        case $holder in
            "" | *[!0-9]*) continue ;;
        esac
        ancestor=$$
        while [ -n "$ancestor" ] && [ "$ancestor" -gt 1 ]; do
            if [ "$ancestor" = "$holder" ]; then
                printf '%s\n' "$holder"
                return 0
            fi
            ancestor=$(awk '{ sub(/^.*\) /, ""); print $2 }' \
                "/proc/$ancestor/stat" 2>/dev/null) || break
        done
    done < <(lslocks -n -o PID,PATH 2>/dev/null |
        awk -v want="$heavy_lock" '$2 == want { print $1 }')
    return 0
}

heavy_holder=$(heavy_ancestor_holder)
if [ -n "$heavy_holder" ]; then
    printf 'heavy: %s held by ancestor %s; running in place\n' \
        "$heavy_lock" "$heavy_holder"
    return 0
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

heavy_unit=heavy-$heavy_slug-$(date +%Y%m%d-%H%M%S)-$(printf '%04x' "$RANDOM")

# The name carries the unit, so a leftover names the run that made it.
# mktemp's O_EXCL stops another process planting that name as a symlink.
heavy_env_dir=${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}
heavy_env_file=$(mktemp -p "$heavy_env_dir" \
    "monkey-heavy-env.$heavy_unit.XXXXXXXX") ||
    { echo "heavy: cannot write an environment file in $heavy_env_dir" >&2
      exit 1; }

# Quote one value the way systemd's environment file parser reads it.
heavy_quote() {
    local value=$1
    value=${value//\\/\\\\}
    value=${value//\"/\\\"}
    printf '"%s"' "$value"
}

# Forwarding the caller's environment keeps every knob the scripts read.
# The lock flags and the shell's own bookkeeping stay out of it.
while IFS= read -r -d '' heavy_entry; do
    heavy_name=${heavy_entry%%=*}
    case $heavy_name in
        MONKEY_HEAVY_LOCK | MONKEY_HEAVY_UNIT | PWD | OLDPWD | SHLVL | _) continue ;;
    esac
    [[ $heavy_name =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    printf '%s=' "$heavy_name"
    heavy_quote "${heavy_entry#*=}"
    printf '\n'
done < <(env -0) > "$heavy_env_file" || exit 1

# Type=exec makes the start mean the unit read its environment and exec'd
# its command, so the prelude may unlink the file as soon as systemd-run
# returns. The wrapper unlinks it first thing in the unit, so the job's
# own body never finds it, and holds no ${NAME}, which systemd-run would
# expand in an argument.
heavy_run=(systemd-run --user --quiet --unit="$heavy_unit" --collect
    -p Type=exec -p MemoryMax="$heavy_cap" --working-directory="$PWD"
    -p EnvironmentFile="$heavy_env_file" --setenv=MONKEY_HEAVY_UNIT=1)
if [ "$heavy_keep" = 1 ]; then
    heavy_run+=(-p KillMode=process)
fi
if [ "$heavy_background" = 0 ]; then
    heavy_run+=(--pipe)
fi
heavy_run+=(-- /bin/sh -c 'rm -f -- "$0"; exec "$@"'
    "$heavy_env_file" "$heavy_self" "${heavy_args[@]}")

printf 'unit: %s (MemoryMax=%s)\n' "$heavy_unit" "$heavy_cap"

if [ "$heavy_background" = 1 ]; then
    ( trap 'rm -f -- "$heavy_env_file"' EXIT; "${heavy_run[@]}" ) || exit 1
    printf 'follow: journalctl --user -u %s -f\n' "$heavy_unit"
    exit 0
fi

if ( trap 'rm -f -- "$heavy_env_file"' EXIT; "${heavy_run[@]}" ); then
    heavy_rc=0
else
    heavy_rc=$?
fi
printf 'unit %s exit %s\n' "$heavy_unit" "$heavy_rc"
exit "$heavy_rc"
