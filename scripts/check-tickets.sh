#!/usr/bin/env bash
# Check the ticket folders at the fork point and at HEAD.
# The rule lives in tickets/README.md and the 20261120 ADR.
set -euo pipefail

base=origin/main

usage() {
    cat <<'EOF'
usage: scripts/check-tickets.sh [--base <ref>]

Checks the ticket folders at <ref> and at HEAD, for the commits in <ref>..HEAD.
<ref> defaults to origin/main. The check skips when <ref> does not resolve.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --base)
            [ $# -ge 2 ] || { usage >&2; exit 2; }
            base=$2
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'check-tickets: unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

if ! top="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    echo "ticket move: skipped (not a git work tree)"
    exit 0
fi
cd "$top"

if ! base_sha="$(git rev-parse --verify -q "$base^{commit}" 2>/dev/null)"; then
    echo "ticket move: skipped (no $base)"
    exit 0
fi
fork_sha="$(git merge-base "$base_sha" HEAD 2>/dev/null || true)"
[ -n "$fork_sha" ] || fork_sha="$base_sha"

status=0

report() {
    printf 'ticket move: %s: %s\n' "$1" "$2" >&2
    status=1
}

stems_at() {
    git ls-tree -r --name-only "$1" -- "tickets/$2" 2>/dev/null |
        sed -n "s|^tickets/$2/\([^/]*\)\.md$|\1|p" |
        sort -u
}

# A literal match, so the diff never depends on the sort locale.
moved_into() {
    local folder="$1" base_stems
    base_stems="$(stems_at "$fork_sha" "$folder")"
    stems_at HEAD "$folder" |
        while IFS= read -r stem; do
            grep -qxF -- "$stem" <<< "$base_stems" && continue
            printf '%s\n' "$stem"
        done
}

# Read the log first. Through a pipe, `grep -q` exits at the first match and
# `git log` dies on SIGPIPE, which `pipefail` reports as a failed pipeline.
log="$(git log --format=%B "$fork_sha..HEAD")"
stay_open=false
if [ -n "$log" ] &&
    grep -qE '^[[:space:]]*Ticket:[[:space:]]*stays-open[[:space:]]*$' <<< "$log"; then
    stay_open=true
fi

outcome_of() {
    printf '%s\n' "$1" |
        awk '/^## Outcome[[:space:]]*$/ { found = 1; next }
             found && /^## / { exit }
             found' |
        sed 's/^[[:space:]]*//; s/[[:space:]]*$//' |
        sed '/^$/d' |
        awk 'NR > 1 { printf " " } { printf "%s", $0 }'
}

moved=0

while IFS= read -r stem; do
    [ -n "$stem" ] || continue
    moved=$((moved + 1))
    if ! $stay_open; then
        report "tickets/doing/$stem.md" \
            "still open; move it to tickets/done/ or add a 'Ticket: stays-open' trailer"
    fi
done < <(moved_into "doing")

while IFS= read -r stem; do
    [ -n "$stem" ] || continue
    moved=$((moved + 1))
    path="tickets/done/$stem.md"
    body="$(git show "HEAD:$path")"
    pr="$(printf '%s\n' "$body" | sed -n 's/^pr:[[:space:]]*//p' | head -n 1 | sed 's/[[:space:]]*$//')"
    if [ -z "$pr" ]; then
        report "$path" "moved to done with an empty pr:"
    fi
    outcome="$(outcome_of "$body")"
    case "$outcome" in
        '' | '(filled in before moving to done/)')
            report "$path" "moved to done with an empty Outcome"
            ;;
    esac
done < <(moved_into "done")

if [ "$status" -ne 0 ]; then
    exit 1
fi

echo "ticket move: ok ($moved moved)"
