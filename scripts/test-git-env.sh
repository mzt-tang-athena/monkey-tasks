#!/usr/bin/env bash
# Replay a push from a linked worktree while GIT_DIR names the main repo.
# A shared recipe that runs git must not inherit it, or it reads the main
# checkout's HEAD instead of the worktree's.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
makefile="${TEMPLATE_MK:-$root/template.mk}"

unset GIT_DIR GIT_WORK_TREE GIT_IMPLICIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE \
    GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE \
    GIT_PREFIX GIT_SHALLOW_FILE GIT_GRAFT_FILE

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

[ -f "$makefile" ] || fail "no $makefile"

remote="$tmp/remote.git"
git init -q --bare "$remote"

repo="$tmp/repo"
git init -q -b main "$repo"
cp "$makefile" "$repo/template.mk"
printf 'include template.mk\n' > "$repo/Makefile"
mkdir -p "$repo/scripts"
cp "$root/scripts/check-records.sh" "$root/scripts/check-tickets.sh" "$repo/scripts/"
printf '# fixture\n' > "$repo/README.md"
git -C "$repo" add -A
git -C "$repo" commit -qm "fixture base"
git -C "$repo" remote add origin "$remote"
git -C "$repo" push -q origin main

wt="$tmp/wt"
git -C "$repo" worktree add -q -b feature "$wt"
mkdir -p "$wt/tickets/doing"
cat > "$wt/tickets/doing/20261120-lane.md" <<'TICKET'
---
title: Lane ticket
created: 2026-11-20
priority: normal
assignee: test
pr: 7
depends: []
---

## Spec

The branch claims this ticket and leaves it open.

## Outcome

(not yet)
TICKET
printf 'change\n' > "$wt/change.txt"
git -C "$wt" add -A
git -C "$wt" commit -qm "claim the lane ticket"

mkdir -p "$repo/.git/hooks"
cat > "$repo/.git/hooks/pre-push" <<EOF
#!/bin/sh
set -eu
GIT_DIR='$repo/.git' make -C '$wt' check-records
EOF
chmod +x "$repo/.git/hooks/pre-push"

main_head="$(git -C "$repo" rev-parse HEAD)"
wt_head="$(git -C "$wt" rev-parse HEAD)"

set +e
out="$(git -C "$wt" push -q origin feature 2>&1)"
push_rc=$?
set -e

case "$out" in
    *"record names: ok"*) ;;
    *) fail "the recipe did not run check-records.sh: $out" ;;
esac
case "$out" in
    *"tickets/doing/20261120-lane.md"*) ;;
    *) fail "the ticket check read the main checkout, not the worktree (push rc $push_rc): $out" ;;
esac

[ "$(git -C "$repo" config --get core.bare || true)" != true ] ||
    fail "the push left core.bare=true on the main checkout: $out"
[ "$(git -C "$repo" rev-parse HEAD)" = "$main_head" ] ||
    fail "the push moved the main checkout HEAD: $out"
[ "$(git -C "$wt" rev-parse HEAD)" = "$wt_head" ] ||
    fail "the push moved the worktree HEAD: $out"
[ "$(git -C "$wt" symbolic-ref -q HEAD)" = refs/heads/feature ] ||
    fail "the push detached the worktree HEAD: $out"

printf 'check-git-env: a worktree push read the worktree, not the main checkout\n'
