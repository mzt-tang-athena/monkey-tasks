#!/usr/bin/env bash
# Fail when a tracked file holds a literal credential.
# CI runs this check, and so does `make lint` before a push.
set -euo pipefail

status=0

report() {
    printf 'check-secrets: %s\n' "$1" >&2
    status=1
}

# GitHub token shapes: classic, OAuth, server-to-server, user-to-server,
# refresh, and fine-grained.
while IFS= read -r hit; do
    report "$hit"
done < <(git grep -nI -E 'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}' -- . || true)

# A token line in an npmrc must name an environment variable.
# A literal value is a secret in git.
while IFS= read -r -d '' file; do
    while IFS= read -r hit; do
        # The literal `${` is the signal, so it stays unexpanded.
        # shellcheck disable=SC2016
        case "$hit" in
            *'_authToken=${'*) ;;
            *) report "$file:$hit" ;;
        esac
    done < <(grep -n '_authToken=' "$file" || true)
done < <(git ls-files -z | while IFS= read -r -d '' path; do
    case "$path" in
        *.npmrc) printf '%s\0' "$path" ;;
    esac
done)

if [ "$status" -eq 0 ]; then
    echo 'check-secrets: no literal credentials in tracked files'
fi
exit "$status"
