#!/usr/bin/env bash
# List the merged PRs since a tag that carry no changelog line. A release
# stops when one of them changed app code a user can see.
#
# The tag defaults to the newest v<version> tag reachable from HEAD. Each
# PR is its squash commit, so its diff is the PR's change.
set -euo pipefail

since=""

usage() {
    cat <<'EOF'
usage: scripts/check-release-notes.sh [--since <tag>]

  --since   count the PRs merged after this tag. The default is the
            newest v<version> tag reachable from HEAD.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --since)
            [ $# -ge 2 ] || { usage >&2; exit 2; }
            since=$2
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'release notes: unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

root="$(git rev-parse --show-toplevel)"
cd "$root"

if ! command -v gh >/dev/null 2>&1; then
    printf 'release notes: gh is needed to list the merged PRs\n' >&2
    exit 2
fi

if [ -z "$since" ]; then
    since="$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)"
fi
if [ -n "$since" ] && ! git rev-parse --verify -q "${since}^{commit}" >/dev/null; then
    printf 'release notes: %s is not a tag in this clone\n' "$since" >&2
    exit 2
fi

prs="$(gh pr list --state merged --limit 200 \
    --json number,title,mergeCommit,url \
    --jq '.[] | [.number, .title, (.mergeCommit.oid // ""), (.url // "")] | @tsv')"

fetched=0
count=0
missing=0
stop=0

while IFS=$'\t' read -r number title sha url; do
    [ -n "$number" ] || continue
    fetched=$((fetched + 1))
    if [ -z "$sha" ]; then
        printf 'release notes: #%s has no squash commit; not checked\n' "$number" >&2
        continue
    fi
    if ! git merge-base --is-ancestor "$sha" HEAD; then
        continue
    fi
    if [ -n "$since" ] && git merge-base --is-ancestor "$sha" "${since}^{commit}"; then
        continue
    fi
    count=$((count + 1))

    files="$(git show --name-only --format= "$sha")"
    if printf '%s\n' "$files" | grep -qx 'CHANGELOG.md'; then
        continue
    fi
    if git log -1 --format=%B "$sha" | grep -Fxq 'Changelog: none'; then
        continue
    fi

    missing=$((missing + 1))
    visible="$(printf '%s\n' "$files" | scripts/visible-paths.sh)"
    if [ -n "$visible" ]; then
        printf 'release notes: #%s has no changelog line: %s\n' "$number" "$title" >&2
        printf '  %s\n' "$url" >&2
        printf '%s\n' "$visible" | sed -n '1,3s/^/  /p' >&2
        stop=1
    else
        printf 'release notes: #%s has no changelog line: %s' "$number" "$title" >&2
        printf ' (changed no app code a user can see)\n' >&2
    fi
done <<< "$prs"

if [ "$fetched" -ge 200 ]; then
    printf 'release notes: only the newest 200 merged PRs were checked\n' >&2
fi

if [ "$stop" -ne 0 ]; then
    printf 'release notes: a merged PR changed visible app code without a line\n' >&2
    exit 1
fi

printf 'release notes: ok (%d merged PRs since %s, %d without a line)\n' \
    "$count" "${since:-the first commit}" "$missing"
