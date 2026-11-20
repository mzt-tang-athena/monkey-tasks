#!/usr/bin/env bash
# Exercise check-tickets.sh against fixture repos.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
checker="$here/check-tickets.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

new_repo() {
    local dir="$tmp/$1"
    mkdir -p "$dir/tickets/open" "$dir/tickets/doing" "$dir/tickets/done"
    git -C "$dir" init -q -b main
    git -C "$dir" config user.email test@example.com
    git -C "$dir" config user.name test
    git -C "$dir" config commit.gpgsign false
    printf '%s\n' "$dir"
}

commit() {
    git -C "$1" add -A
    git -C "$1" commit -q -m "$2"
}

# write_ticket <dir> <folder> <stem> <pr> <outcome>
write_ticket() {
    mkdir -p "$1/tickets/$2"
    cat > "$1/tickets/$2/$3.md" <<EOF
---
title: $3
created: 2026-11-20
priority: normal
assignee:
pr: $4
depends: []
---

## Spec

A fixture ticket.

## Acceptance

- [ ] one condition

## Outcome

$5
EOF
}

# move_ticket <dir> <from-folder> <to-folder> <stem>
move_ticket() {
    mkdir -p "$1/tickets/$3"
    mv "$1/tickets/$2/$4.md" "$1/tickets/$3/$4.md"
}

run_check() {
    set +e
    out="$(cd "$1" && "$checker" --base "$2" 2>"$tmp/stderr")"
    code=$?
    set -e
    err="$(cat "$tmp/stderr")"
}

# pass_case <label> <dir> <base> [exact stdout]
pass_case() {
    local label="$1" dir="$2" base="$3" want_out="${4:-}"
    run_check "$dir" "$base"
    [ "$code" -eq 0 ] || fail "$label: expected exit 0, got $code; stderr: $err"
    case "$out" in
        'ticket move: ok ('*) ;;
        'ticket move: skipped ('*) ;;
        *) fail "$label: unexpected stdout: $out" ;;
    esac
    if [ -n "$want_out" ] && [ "$out" != "$want_out" ]; then
        fail "$label: expected '$want_out', got '$out'"
    fi
    assertions=$((assertions + 1))
}

# fail_case <label> <dir> <base> <text stderr must name>
fail_case() {
    local label="$1" dir="$2" base="$3" want="$4"
    run_check "$dir" "$base"
    [ "$code" -eq 1 ] || fail "$label: expected exit 1, got $code; stderr: $err"
    case "$err" in
        *"$want"*) ;;
        *) fail "$label: stderr does not name $want: $err" ;;
    esac
    case "$err" in
        'ticket move: '*) ;;
        *) fail "$label: stderr missing the ticket move prefix: $err" ;;
    esac
    assertions=$((assertions + 1))
}

# A branch that touches no ticket passes.
dir="$(new_repo untouched)"
write_ticket "$dir" open 20261120-untouched 7 "Done."
printf 'notes\n' > "$dir/README.md"
commit "$dir" "docs: add notes"
base="$(git -C "$dir" rev-parse HEAD)"
printf 'notes\nmore\n' > "$dir/README.md"
commit "$dir" "docs: extend notes"
pass_case "branch touches no ticket" "$dir" "$base" "ticket move: ok (0 moved)"

# A ticket moved into doing/ and left there fails.
dir="$(new_repo stuck)"
write_ticket "$dir" open 20261120-stuck 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open doing 20261120-stuck
commit "$dir" "chore(tickets): claim stuck"
fail_case "ticket left in doing" "$dir" "$base" "tickets/doing/20261120-stuck.md"

# The trailer lets that ticket stay open.
dir="$(new_repo trailer)"
write_ticket "$dir" open 20261120-trailer 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open doing 20261120-trailer
commit "$dir" "chore(tickets): claim trailer

Ticket: stays-open"
pass_case "trailer keeps a ticket open" "$dir" "$base" "ticket move: ok (1 moved)"

# A long log must not lose the trailer. `grep -q` stops at the first match,
# and a pipeline that also holds `git log` then reads as no match under
# pipefail, because git log dies on SIGPIPE.
dir="$(new_repo long-log)"
write_ticket "$dir" open 20261120-long-log 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open doing 20261120-long-log
commit "$dir" "chore(tickets): claim long-log"
for i in $(seq 1 300); do
    git -C "$dir" commit -q --allow-empty -m "chore: pad $i

Padding body for commit $i. It holds enough words to fill a pipe buffer
once the log for three hundred commits is written in one go."
done
git -C "$dir" commit -q --allow-empty -m "chore: keep long-log open

Ticket: stays-open"
pass_case "long log keeps the trailer" "$dir" "$base" "ticket move: ok (1 moved)"

# A ticket moved into done/ with a pr and an Outcome passes.
dir="$(new_repo closed)"
write_ticket "$dir" open 20261120-closed 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open doing 20261120-closed
commit "$dir" "chore(tickets): claim closed"
move_ticket "$dir" doing "done" 20261120-closed
write_ticket "$dir" "done" 20261120-closed 7 "Pull request #7 carries it."
commit "$dir" "chore(tickets): close closed"
pass_case "ticket closed with pr and Outcome" "$dir" "$base" "ticket move: ok (1 moved)"

# A ticket moved into done/ with an empty pr fails.
dir="$(new_repo no-pr)"
write_ticket "$dir" open 20261120-no-pr 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open "done" 20261120-no-pr
write_ticket "$dir" "done" 20261120-no-pr "" "Pull request #7 carries it."
commit "$dir" "chore(tickets): close no-pr"
fail_case "empty pr" "$dir" "$base" "moved to done with an empty pr:"

# A ticket moved into done/ with an empty Outcome fails.
dir="$(new_repo no-outcome)"
write_ticket "$dir" open 20261120-no-outcome 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open "done" 20261120-no-outcome
write_ticket "$dir" "done" 20261120-no-outcome 7 ""
commit "$dir" "chore(tickets): close no-outcome"
fail_case "empty Outcome" "$dir" "$base" "moved to done with an empty Outcome"

# The template's Outcome placeholder does not count as an Outcome.
dir="$(new_repo placeholder)"
write_ticket "$dir" open 20261120-placeholder 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open "done" 20261120-placeholder
write_ticket "$dir" "done" 20261120-placeholder 7 "(filled in before moving to done/)"
commit "$dir" "chore(tickets): close placeholder"
fail_case "placeholder Outcome" "$dir" "$base" "moved to done with an empty Outcome"

# The trailer does not excuse a closed ticket with an empty pr.
dir="$(new_repo trailer-done)"
write_ticket "$dir" open 20261120-trailer-done 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
move_ticket "$dir" open "done" 20261120-trailer-done
write_ticket "$dir" "done" 20261120-trailer-done "" "Done."
commit "$dir" "chore(tickets): close trailer-done

Ticket: stays-open"
fail_case "trailer does not cover done" "$dir" "$base" "moved to done with an empty pr:"

# A ticket already in doing/ at the fork point is not the branch's move.
dir="$(new_repo claimed-earlier)"
write_ticket "$dir" doing 20261120-claimed-earlier 7 "Done."
commit "$dir" "chore: seed"
base="$(git -C "$dir" rev-parse HEAD)"
printf 'notes\n' > "$dir/README.md"
commit "$dir" "docs: add notes"
pass_case "claimed before the branch" "$dir" "$base" "ticket move: ok (0 moved)"

# An unknown base ref skips instead of failing.
dir="$(new_repo no-base)"
write_ticket "$dir" open 20261120-no-base 7 "Done."
commit "$dir" "chore: seed"
pass_case "unknown base skips" "$dir" "origin/nothing" "ticket move: skipped (no origin/nothing)"

printf 'check-tickets: %s assertions passed\n' "$assertions"
