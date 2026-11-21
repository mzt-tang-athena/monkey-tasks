#!/usr/bin/env bash
# Exercise check-changelog-entry.sh against fixture repositories.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
checker="$here/check-changelog-entry.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

# new_repo <dir>: a repo on main with origin/main, one app file and a
# changelog.
new_repo() {
    local dir="$1"
    git init -q "$dir"
    mkdir -p "$dir/scripts"
    cp "$here/visible-paths.sh" "$dir/scripts/"
    chmod +x "$dir/scripts/visible-paths.sh"
    (
        cd "$dir"
        git config user.name Test
        git config user.email test@example.com
        git config commit.gpgsign false
        mkdir -p app/src
        printf 'base\n' > README.md
        printf 'export const value = 1;\n' > app/src/app.ts
        printf '# Changelog\n' > CHANGELOG.md
        git add -A
        git commit -qm base
        git branch -m main
        git update-ref refs/remotes/origin/main HEAD
    )
}

# commit_in <dir> <message>: commit the working tree, body split on |.
commit_in() {
    local dir="$1" message="$2" msg
    msg="$(mktemp)"
    printf '%s' "$message" | tr '|' '\n' > "$msg"
    (
        cd "$dir"
        git add -A
        git commit -qF "$msg"
    )
    rm -f "$msg"
}

# check <dir> [args...]: run the checker there and capture the result.
check() {
    local dir="$1"
    shift
    set +e
    out="$(cd "$dir" && "$checker" "$@" 2>"$tmp/stderr")"
    code=$?
    set -e
    err="$(cat "$tmp/stderr")"
}

pass_case() {
    local label="$1" dir="$2"
    shift 2
    check "$dir" "$@"
    [ "$code" -eq 0 ] || fail "$label: expected exit 0, got $code; stderr: $err"
    case "$out" in
        'changelog entry: ok ('*')') ;;
        *) fail "$label: unexpected stdout: $out" ;;
    esac
    assertions=$((assertions + 1))
}

fail_case() {
    local label="$1" dir="$2" want="$3"
    shift 3
    check "$dir" "$@"
    [ "$code" -eq 1 ] || fail "$label: expected exit 1, got $code; stderr: $err"
    case "$err" in
        *"$want"*) ;;
        *) fail "$label: stderr does not name $want: $err" ;;
    esac
    case "$err" in
        'changelog entry: the branch changes app code a user can see:'*) ;;
        *) fail "$label: stderr missing the reason: $err" ;;
    esac
    assertions=$((assertions + 1))
}

visible="$tmp/visible"
new_repo "$visible"
printf 'export const value = 2;\n' > "$visible/app/src/app.ts"
commit_in "$visible" "Change the value"
fail_case "visible change without a bullet" "$visible" "app/src/app.ts"

with_bullet="$tmp/with-bullet"
new_repo "$with_bullet"
printf 'export const value = 2;\n' > "$with_bullet/app/src/app.ts"
printf -- '- A new value.\n' >> "$with_bullet/CHANGELOG.md"
commit_in "$with_bullet" "Change the value"
pass_case "visible change with a bullet" "$with_bullet" --base origin/main

escaped="$tmp/escaped"
new_repo "$escaped"
printf 'export const value = 2;\n' > "$escaped/app/src/app.ts"
commit_in "$escaped" "Refactor the value|Changelog: none"
pass_case "trailer escape" "$escaped"

# A long log must keep the escape. `grep -q` stops at the first match, and a
# pipeline that also holds `git log` then reads as no match under pipefail,
# because git log dies on SIGPIPE.
long="$tmp/long"
new_repo "$long"
for i in $(seq 1 300); do
    git -C "$long" commit -q --allow-empty -m "chore: pad $i

Padding body for commit $i. It holds enough words to fill a pipe buffer
once the log for three hundred commits is written in one go."
done
printf 'export const value = 2;\n' > "$long/app/src/app.ts"
commit_in "$long" "Refactor the value|Changelog: none"
pass_case "long log keeps the escape" "$long"
case "$out" in
    *'skipped by Changelog: none'*) assertions=$((assertions + 1)) ;;
    *) fail "long log keeps the escape: wrong reason: $out" ;;
esac

test_only="$tmp/test-only"
new_repo "$test_only"
printf 'export const value = 3;\n' > "$test_only/app/src/app.test.ts"
commit_in "$test_only" "Test the value"
pass_case "test-only change" "$test_only"

docs_only="$tmp/docs-only"
new_repo "$docs_only"
printf 'More words.\n' >> "$docs_only/README.md"
commit_in "$docs_only" "Explain the value"
pass_case "docs-only change" "$docs_only"

no_origin="$tmp/no-origin"
new_repo "$no_origin"
git -C "$no_origin" update-ref -d refs/remotes/origin/main
printf 'export const value = 2;\n' > "$no_origin/app/src/app.ts"
commit_in "$no_origin" "Change the value"
pass_case "absent origin/main" "$no_origin"

printf 'changelog check: ok (%d cases)\n' "$assertions"
