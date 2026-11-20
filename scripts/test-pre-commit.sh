#!/usr/bin/env bash
# Exercise .githooks/pre-commit against fixture repositories.
#
# Every ticket close renames the ticket and edits it in one commit, so
# the hook must lint a staged rename. A list of only A, C and M drops it.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
hook="$root/.githooks/pre-commit"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

command -v vale >/dev/null 2>&1 ||
    fail "vale is not installed, so the doc checks cannot run; see README.md"
[ -d "$root/.vale/styles/MyRules" ] ||
    fail "no Vale styles in $root/.vale/styles; run npx vale-rules sync"

# new_repo <name>: a repository with this repo's Vale config, one ticket,
# one app file and a linter that fails. Everything is committed.
new_repo() {
    local dir="$tmp/$1"
    git init -q "$dir"
    (
        cd "$dir"
        git config user.name Test
        git config user.email test@example.com
        git config commit.gpgsign false
        ln -s "$root/.vale" .vale
        cp "$root/.vale.ini" .vale.ini
        mkdir -p tickets/doing tickets/done app/src app/node_modules/.bin
        printf '%s\n' \
            '---' \
            'title: A thing' \
            'created: 2026-11-20' \
            '---' \
            '' \
            '## Spec' \
            '' \
            'The body runs long enough for git to see a rename. Git calls' \
            'a move a rename while most of the file stays the same. A' \
            'short line would land under the bar, and git would call the' \
            'move an add and a delete instead.' \
            '' \
            '## Acceptance' \
            '' \
            '- [ ] the body keeps its shape' \
            > tickets/doing/20261120-a-thing.md
        printf 'export const value = 1;\n' > app/src/thing.ts
        cat > app/node_modules/.bin/eslint <<'STUB'
#!/bin/sh
printf 'eslint stub: %s\n' "$*" >&2
exit 1
STUB
        chmod +x app/node_modules/.bin/eslint
        git add -A
        git commit -qm base
    )
    printf '%s\n' "$dir"
}

# stage_rename <dir> <from> <to> [line]: move a file and add one line to
# it in the same staged change, the way a ticket close does. Then check
# that git still read a rename. An add would pass the hook even with the
# filter bug, so a case that staged an add proves nothing.
stage_rename() {
    local dir="$1" from="$2" to="$3" line="${4:-}" status
    (cd "$dir" && git mv "$from" "$to")
    if [ -n "$line" ]; then
        printf '%s\n' "$line" >> "$dir/$to"
    fi
    (cd "$dir" && git add -A)
    status="$(cd "$dir" && git diff --cached --name-status)"
    case "$status" in
        R*"$to") ;;
        *) fail "git staged no rename of $to, so the case proves nothing: $status" ;;
    esac
    assertions=$((assertions + 1))
}

# hook_in <dir>: run the hook there and capture the result.
run_hook() {
    set +e
    out="$(cd "$1" && "$hook" 2>&1)"
    code=$?
    set -e
}

# blocked <label> <dir> <text the output must hold>
blocked() {
    local label="$1" dir="$2" want="$3"
    run_hook "$dir"
    [ "$code" -ne 0 ] || fail "$label: the hook let the commit through"
    case "$out" in
        *"$want"*) ;;
        *) fail "$label: the hook output does not name $want: $out" ;;
    esac
    assertions=$((assertions + 1))
}

# allowed <label> <dir>
allowed() {
    local label="$1" dir="$2"
    run_hook "$dir"
    [ "$code" -eq 0 ] || fail "$label: expected exit 0, got $code: $out"
    assertions=$((assertions + 1))
}

long="This sentence runs well past the bar of twenty words, and it keeps going because nobody stopped it before the period arrived."

dir="$(new_repo rename-doc)"
stage_rename "$dir" tickets/doing/20261120-a-thing.md \
    tickets/done/20261120-a-thing.md "## Outcome"$'\n\n'"$long"
blocked "a renamed ticket with a long sentence" "$dir" \
    "tickets/done/20261120-a-thing.md"

dir="$(new_repo rename-doc-clean)"
stage_rename "$dir" tickets/doing/20261120-a-thing.md \
    tickets/done/20261120-a-thing.md "## Outcome"$'\n\n'"Done."
allowed "a renamed ticket with clean prose" "$dir"

dir="$(new_repo rename-doc-space)"
stage_rename "$dir" tickets/doing/20261120-a-thing.md \
    "tickets/done/20261120-a thing.md" "## Outcome"$'\n\n'"$long"
blocked "a renamed ticket with a space in its name" "$dir" \
    "tickets/done/20261120-a thing.md"

dir="$(new_repo rename-code)"
stage_rename "$dir" app/src/thing.ts app/src/renamed.ts
blocked "a renamed app file" "$dir" "src/renamed.ts"

dir="$(new_repo added-doc)"
printf -- '---\ntitle: Another thing\n---\n\n%s\n' "$long" \
    > "$dir/tickets/done/20261120-b.md"
(cd "$dir" && git add -A)
blocked "an added ticket with a long sentence" "$dir" \
    "tickets/done/20261120-b.md"

dir="$(new_repo deleted-doc)"
(cd "$dir" && git rm -q tickets/doing/20261120-a-thing.md)
allowed "a deleted ticket" "$dir"

printf 'pre-commit hook: %s assertions passed\n' "$assertions"
