#!/usr/bin/env bash
# Prose lint for the markdown a branch changed.
# With paths, lint those. With none, lint the markdown changed against
# origin/main, including untracked files.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ $# -gt 0 ]; then
    paths="$(printf '%s\n' "$@")"
else
    base="$(git merge-base origin/main HEAD 2>/dev/null || true)"
    if [ -n "$base" ]; then
        tracked="$(git diff --name-only "$base" -- '*.md' || true)"
    else
        tracked="$(git diff --name-only HEAD -- '*.md' || true)"
    fi
    untracked="$(git ls-files --others --exclude-standard -- '*.md' || true)"
    paths="$(printf '%s\n%s\n' "$tracked" "$untracked" | sed '/^$/d' | sort -u)"
fi

docs="$(printf '%s\n' "$paths" | while IFS= read -r path; do
    [ -n "$path" ] || continue
    [ -f "$path" ] || continue
    printf '%s\n' "$path"
done)"

if [ -z "$docs" ]; then
    echo "docs prose: ok (no changed docs)"
    exit 0
fi

command -v vale >/dev/null || {
    echo "docs prose: vale is not installed; see README.md" >&2
    exit 1
}

npx vale-rules sync >/dev/null

vale_exit=0
alerts="$(printf '%s\n' "$docs" | tr '\n' '\0' \
    | xargs -0 vale --minAlertLevel=warning --output=line)" || vale_exit=$?

if [ -n "$alerts" ]; then
    printf '%s\n' "$alerts"
    echo "docs prose: fix the alerts above" >&2
    exit 1
fi
if [ "$vale_exit" -ne 0 ]; then
    echo "docs prose: vale exited with $vale_exit and printed no alerts" >&2
    exit 1
fi

echo "docs prose: ok ($(printf '%s\n' "$docs" | wc -l | tr -d ' ') file(s))"
