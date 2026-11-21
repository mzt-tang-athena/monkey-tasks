#!/usr/bin/env bash
# Require a CHANGELOG.md change on a branch that changes app code a user
# can see. The diff is against origin/main, or the ref given by --base.
#
# Escape: a commit since the base whose body holds the trailer line
# `Changelog: none`. Use it when the visible change does not deserve a
# release note, such as a refactor behind the same UI.
set -euo pipefail

base="origin/main"

usage() {
    cat <<'EOF'
usage: scripts/check-changelog-entry.sh [--base <ref>]

  --base   compare against this ref instead of origin/main
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
            printf 'changelog entry: unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

root="$(git rev-parse --show-toplevel)"
cd "$root"

if ! base_sha="$(git rev-parse --verify "${base}^{commit}" 2>/dev/null)"; then
    printf 'changelog entry: ok (%s is absent; skipped)\n' "$base"
    exit 0
fi
merge_base="$(git merge-base "$base_sha" HEAD 2>/dev/null || printf '%s' "$base_sha")"

# Read the log first. Through a pipe, `grep -q` exits at the first match and
# `git log` dies on SIGPIPE, which `pipefail` reports as a failed pipeline.
log="$(git log --format=%B "$merge_base..HEAD")"
if [ -n "$log" ] && grep -Fxq 'Changelog: none' <<< "$log"; then
    echo "changelog entry: ok (skipped by Changelog: none)"
    exit 0
fi

changed="$(git diff --name-only "$merge_base" | sed '/^$/d')"

if printf '%s\n' "$changed" | grep -qx 'CHANGELOG.md'; then
    echo "changelog entry: ok (CHANGELOG.md changed)"
    exit 0
fi

visible="$(printf '%s\n' "$changed" | scripts/visible-paths.sh)"

if [ -z "$visible" ]; then
    echo "changelog entry: ok (no user-visible change)"
    exit 0
fi

printf 'changelog entry: the branch changes app code a user can see:\n' >&2
printf '%s\n' "$visible" | sed -n '1,5s/^/  /p' >&2
if [ "$(printf '%s\n' "$visible" | wc -l)" -gt 5 ]; then
    printf '  ...\n' >&2
fi
printf 'Add a bullet to CHANGELOG.md under the next version, or put\n' >&2
printf '`Changelog: none` in a commit message when it deserves no line.\n' >&2
exit 1
