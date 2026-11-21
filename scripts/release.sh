#!/usr/bin/env bash
# One release, start to finish: the gate receipt, the tag, the build, the
# APK and its checksum, the emulator smoke, the notes, the GitHub release
# and the download check.
#
# Run it from main after `scripts/gate.sh full`. It refuses unless the
# tree is clean, HEAD is origin/main, the app version matches, the
# changelog section is dated, and a full gate receipt passed for HEAD.
set -euo pipefail

usage() {
    cat <<'EOF'
usage: scripts/release.sh <version> [--dry-run] [--no-publish]

  <version>     the release, such as 1.3.0. The tag is v<version>.

  --dry-run     print every step, run nothing, change nothing.
  --no-publish  rehearse: run the local steps, tag only in this clone,
                and stop before the tag is pushed or the release is made.
                The tag is deleted on the way out.

RELEASE_ARCHIVE moves the folder that holds the APK and the notes. Its
default is ~/code/monkey-tasks/archive/release-<version>.
EOF
}

refuse() {
    printf 'release: refused: %s\n' "$*" >&2
    exit 2
}

die() {
    printf 'release: stopped: %s\n' "$*" >&2
    exit 1
}

say() {
    printf 'release: %s\n' "$*"
}

version=""
dry_run=false
publish=true

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)
            dry_run=true
            ;;
        --no-publish)
            publish=false
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            printf 'release: unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
        *)
            [ -z "$version" ] || { usage >&2; exit 2; }
            version=$1
            ;;
    esac
    shift
done

[ -n "$version" ] || { usage >&2; exit 2; }
printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' ||
    refuse "$version is not a version such as 1.3.0"

root="$(git rev-parse --show-toplevel)"
cd "$root"

head_sha="$(git rev-parse HEAD)"
head="$(git rev-parse --short=12 HEAD)"
tag="v$version"
apk="monkey-tasks-$version.apk"
sha_file="$apk.sha256"
archive="${RELEASE_ARCHIVE:-$HOME/code/monkey-tasks/archive/release-$version}"
smoke_log="$archive/smoke.log"
built_apk="$root/app/android/app/build/outputs/apk/release/app-release.apk"

remote="$(git remote get-url origin 2>/dev/null || true)"
case "$remote" in
    git@github.com:*) slug="${remote#git@github.com:}" ;;
    https://github.com/*) slug="${remote#https://github.com/}" ;;
    ssh://git@github.com/*) slug="${remote#ssh://git@github.com/}" ;;
    *) slug="" ;;
esac
slug="${slug%.git}"
repo="${slug##*/}"
[ -n "$repo" ] || repo="$(basename "$root")"
state_dir="${LOCAL_GATE_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/local-gate}"
receipt="$state_dir/$repo--$head_sha.json"

say "release $version"
if $publish; then
    say "publishing: the tag is pushed and the release is made"
else
    say "rehearsal: the tag stays in this clone and no release is made"
fi
printf '  1/8 gate     the full gate receipt for %s\n' "$head"
printf '  2/8 tag      git tag -a %s -m "monkey-tasks %s"' "$tag" "$version"
if $publish; then printf '; git push origin %s' "$tag"; fi
printf '\n'
printf '  3/8 build    CLEAN=1 .claude/skills/verify-monkey-tasks/scripts/android-build.sh %s\n' "$root"
printf '  4/8 copy     %s and its .sha256 into %s\n' "$apk" "$archive"
printf '  5/8 smoke    .claude/skills/verify-monkey-tasks/scripts/android-release-smoke.sh %s\n' "$archive/$apk"
printf '  6/8 notes    cut ## %s from %s into %s\n' "$version" "$tag" "$archive/release-notes.md"
if $publish; then
    printf '  7/8 publish  gh release create %s --verify-tag with the APK and the checksum\n' "$tag"
    printf '  8/8 verify   download the release and check it against the checksum\n'
else
    printf '  7/8 publish  skipped (--no-publish)\n'
    printf '  8/8 verify   skipped (--no-publish)\n'
fi

blockers=()
block() {
    blockers+=("$*")
}

branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if $publish; then
    [ "$branch" = main ] || block "checkout main, not ${branch:-a detached HEAD}"
    if [ -z "$(git rev-parse --verify -q origin/main)" ]; then
        block "origin/main is not fetched"
    elif [ "$(git rev-parse origin/main)" != "$head_sha" ]; then
        block "HEAD is not origin/main; push main first"
    fi
else
    say "rehearsal: branch $branch and its place against origin/main are not checked"
fi

if [ -n "$(git status --porcelain)" ]; then
    block "the tree is dirty"
fi

app_version="$(jq -r '.expo.version // empty' app/app.json 2>/dev/null || true)"
[ "$app_version" = "$version" ] ||
    block "app/app.json holds ${app_version:-no version}, not $version"

escaped="${version//./\\.}"
if ! grep -qE "^## $escaped - [0-9]{4}-[0-9]{2}-[0-9]{2}$" CHANGELOG.md; then
    if grep -qE "^## $escaped - unreleased$" CHANGELOG.md; then
        block "CHANGELOG.md still says $version is unreleased; date the section"
    else
        block "CHANGELOG.md has no dated ## $version section"
    fi
fi

if git rev-parse --verify -q "refs/tags/$tag" >/dev/null; then
    block "tag $tag already exists in this clone"
fi
if $publish && [ -n "$remote" ]; then
    found=0
    git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1 || found=$?
    case "$found" in
        0) block "tag $tag already exists on origin" ;;
        2) ;;
        *) block "could not ask origin about tag $tag" ;;
    esac
fi

if [ ! -f "$receipt" ]; then
    block "no gate receipt for $head; run scripts/gate.sh full"
else
    r_sha="$(jq -r '.sha // empty' "$receipt")"
    r_mode="$(jq -r '.mode // empty' "$receipt")"
    r_result="$(jq -r '.result // empty' "$receipt")"
    r_dirty="$(jq -r 'if .dirty == false then "false" else "true" end' "$receipt")"
    r_at="$(jq -r '.started_at // empty' "$receipt")"
    [ "$r_sha" = "$head_sha" ] || block "the gate receipt is for ${r_sha:-another commit}"
    [ "$r_mode" = full ] || block "the gate receipt is ${r_mode:-no mode}; run scripts/gate.sh full"
    [ "$r_result" = pass ] || block "the gate receipt did not pass"
    [ "$r_dirty" = false ] || block "the gate receipt was written on a dirty tree"
fi

if scripts/check-release-notes.sh; then
    :
else
    block "a merged PR since the last tag lacks a changelog line"
fi

if $dry_run; then
    if [ ${#blockers[@]} -gt 0 ]; then
        printf 'release: dry run: the release would refuse:\n' >&2
        printf '  %s\n' "${blockers[@]}" >&2
        exit 1
    fi
    say "dry run: every check passed and nothing was changed"
    exit 0
fi

if [ ${#blockers[@]} -gt 0 ]; then
    printf 'release: refused:\n' >&2
    printf '  %s\n' "${blockers[@]}" >&2
    exit 2
fi

say "1/8 gate: the receipt for $head passed ($r_mode, $r_at)"

say "2/8 tag: $tag"
git tag -a "$tag" -m "monkey-tasks $version"
if $publish; then
    git push origin "$tag"
else
    trap 'git tag -d "$tag" >/dev/null 2>&1 || true' EXIT
    say "rehearsal: the tag stays in this clone and is deleted on the way out"
fi

say "3/8 build: a clean release build for every CPU type"
CLEAN=1 .claude/skills/verify-monkey-tasks/scripts/android-build.sh "$root"
[ -f "$built_apk" ] || die "the build left no APK at $built_apk"

say "4/8 copy: $apk and its checksum into $archive"
mkdir -p "$archive"
cp "$built_apk" "$archive/$apk"
(cd "$archive" && sha256sum "$apk" > "$sha_file")
printf '%s\n' "$(git rev-parse --short HEAD)" > "$archive/BUILT_FROM"

say "5/8 smoke: the release pass on the emulator"
smoke_rc=0
.claude/skills/verify-monkey-tasks/scripts/android-release-smoke.sh "$archive/$apk" 2>&1 |
    tee "$smoke_log" || smoke_rc=$?
fail_lines="$(grep -c '^FAIL:' "$smoke_log" 2>/dev/null || true)"
if [ "$smoke_rc" -ne 0 ] || [ "${fail_lines:-0}" -ne 0 ]; then
    die "the smoke failed (exit $smoke_rc, ${fail_lines:-0} FAIL line(s)); nothing was published"
fi

say "6/8 notes: cut the $version section from $tag"
git show "$tag:CHANGELOG.md" | awk -v v="$version" '
    /^## / {
        if (on) exit
        if ($0 ~ "^## " v "( |$)") on = 1
    }
    on { print }
' > "$archive/release-notes.md"
[ -s "$archive/release-notes.md" ] || die "the $version section is empty"

if $publish; then
    say "7/8 publish: gh release create $tag"
    gh release create "$tag" --verify-tag \
        --title "monkey-tasks $version" \
        --notes-file "$archive/release-notes.md" \
        "$archive/$apk" "$archive/$sha_file"

    say "8/8 verify: download the release and check it against the checksum"
    tmp="$(mktemp -d)"
    gh release download "$tag" --dir "$tmp" --pattern "$apk*"
    (cd "$tmp" && sha256sum -c "$sha_file")
    rm -rf "$tmp"

    say "$version is live at $tag"
else
    say "rehearsal done: the APK, the checksum and the notes are in $archive"
    say "nothing was pushed and no release was made"
fi
