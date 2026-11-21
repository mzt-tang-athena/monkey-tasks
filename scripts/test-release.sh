#!/usr/bin/env bash
# Exercise scripts/release.sh against fixture repositories with stand-ins
# for the gate, the build, the smoke and gh. The real script runs.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"
state="$tmp/state"
bin="$tmp/bin"
mkdir -p "$state" "$bin"
trap 'rm -rf "$tmp"' EXIT

cat > "$bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "gh $*" >> "${CALLS:?}"
case "$*" in
    "pr list"*) ;;
    "release create"*) ;;
    "release download"*)
        dir=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --dir) dir=$2; shift ;;
            esac
            shift
        done
        cp "${RELEASE_ARCHIVE:?}"/* "$dir"/
        ;;
esac
EOF
chmod +x "$bin/gh"

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

# fixture <name>: a repo on main with the real release script, a passing
# gate receipt, and stand-ins for everything slow.
fixture() {
    local name="$1"
    local dir="$tmp/$name"
    git init -q "$dir"
    mkdir -p "$dir/app" "$dir/scripts" \
        "$dir/.claude/skills/verify-monkey-tasks/scripts"
    cp "$here/release.sh" "$here/check-release-notes.sh" "$here/visible-paths.sh" \
        "$dir/scripts/"
    chmod +x "$dir"/scripts/*.sh
    printf '{"expo":{"version":"0.1.0","android":{"versionCode":1}}}\n' \
        > "$dir/app/app.json"
    printf '# Changelog\n\n## 0.1.0 - 2026-01-01\n\n- A thing.\n' \
        > "$dir/CHANGELOG.md"
    printf 'Words.\n' > "$dir/README.md"
    cat > "$dir/.claude/skills/verify-monkey-tasks/scripts/android-build.sh" <<'EOF'
#!/usr/bin/env bash
echo "build $*" >> "$CALLS"
mkdir -p app/android/app/build/outputs/apk/release
printf 'apk bytes\n' > app/android/app/build/outputs/apk/release/app-release.apk
EOF
    cat > "$dir/.claude/skills/verify-monkey-tasks/scripts/android-release-smoke.sh" <<'EOF'
#!/usr/bin/env bash
echo "smoke $*" >> "$CALLS"
echo "PASS: a check"
if [ "${SMOKE_FAILS:-0}" -gt 0 ]; then echo "FAIL: a failing check"; fi
exit "${SMOKE_RC:-0}"
EOF
    chmod +x "$dir"/.claude/skills/verify-monkey-tasks/scripts/*.sh
    (
        cd "$dir"
        git config user.name Test
        git config user.email test@example.com
        git config commit.gpgsign false
        git add -A
        git commit -qm base
        git branch -m main
    )
    git init -q --bare "$tmp/origin-$name.git"
    git -C "$dir" remote add origin "$tmp/origin-$name.git"
    git -C "$dir" push -q -u origin main
    write_receipt "$dir"
    printf '%s\n' "$dir"
}

write_receipt() {
    local dir="$1" result="${2:-pass}" mode="${3:-full}" dirty="${4:-false}"
    local sha repo
    sha="$(git -C "$dir" rev-parse HEAD)"
    repo="$(basename "$dir")"
    jq -n --arg sha "$sha" --arg result "$result" --arg mode "$mode" \
        --argjson dirty "$dirty" \
        '{repo: "fixture", sha: $sha, mode: $mode, dirty: $dirty,
          started_at: "2026-01-01T00:00:00Z", duration_s: 1,
          changed_files: [], steps: [], result: $result}' \
        > "$state/$repo--$sha.json"
}

run() {
    local dir="$1"
    shift
    calls="$tmp/calls-$(basename "$dir")"
    : > "$calls"
    set +e
    out="$(cd "$dir" && CALLS="$calls" RELEASE_ARCHIVE="$dir/archive" \
        LOCAL_GATE_STATE="$state" PATH="$bin:$PATH" \
        SMOKE_RC="${SMOKE_RC:-0}" SMOKE_FAILS="${SMOKE_FAILS:-0}" \
        "$dir/scripts/release.sh" "$@" 2>"$tmp/err")"
    code=$?
    set -e
    err="$(cat "$tmp/err")"
}

expect_refused() {
    local label="$1" dir="$2" want="$3"
    shift 3
    run "$dir" "$@"
    [ "$code" -eq 2 ] || fail "$label: expected exit 2, got $code; stderr: $err"
    case "$err" in
        *"$want"*) ;;
        *) fail "$label: stderr does not name '$want': $err" ;;
    esac
    no_steps "$label" "$dir"
    assertions=$((assertions + 1))
}

expect_failed() {
    local label="$1" dir="$2" want="$3"
    shift 3
    run "$dir" "$@"
    [ "$code" -eq 1 ] || fail "$label: expected exit 1, got $code; stderr: $err"
    case "$err" in
        *"$want"*) ;;
        *) fail "$label: stderr does not name '$want': $err" ;;
    esac
    assertions=$((assertions + 1))
}

expect_ok() {
    local label="$1" dir="$2"
    shift 2
    run "$dir" "$@"
    [ "$code" -eq 0 ] || fail "$label: expected exit 0, got $code; stderr: $err"
    assertions=$((assertions + 1))
}

no_steps() {
    local label="$1" dir="$2"
    if grep -Eq '^(build|smoke|gh release create)' "$calls" 2>/dev/null; then
        fail "$label: a step ran: $(cat "$calls")"
    fi
}

dir="$(fixture dry)"
expect_ok "dry run" "$dir" 0.1.0 --dry-run
for n in 1 2 3 4 5 6 7 8; do
    case "$out" in
        *"$n/8"*) ;;
        *) fail "dry run: the plan has no step $n/8: $out" ;;
    esac
done
no_steps "dry run" "$dir"
[ -z "$(git -C "$dir" tag -l v0.1.0)" ] || fail "dry run made the tag"
[ ! -d "$dir/archive" ] || fail "dry run wrote the archive"

dir="$(fixture dirty)"
printf 'More words.\n' >> "$dir/README.md"
expect_refused "a dirty tree" "$dir" "the tree is dirty" 0.1.0

dir="$(fixture no-receipt)"
rm -f "$state/$(basename "$dir")--$(git -C "$dir" rev-parse HEAD).json"
expect_refused "no receipt" "$dir" "no gate receipt for" 0.1.0

dir="$(fixture fast-receipt)"
write_receipt "$dir" pass fast
expect_refused "a fast receipt" "$dir" "run scripts/gate.sh full" 0.1.0

dir="$(fixture failed-receipt)"
write_receipt "$dir" fail full
expect_refused "a failed receipt" "$dir" "did not pass" 0.1.0

dir="$(fixture dirty-receipt)"
write_receipt "$dir" pass full true
expect_refused "a dirty receipt" "$dir" "dirty tree" 0.1.0

dir="$(fixture wrong-version)"
sed -i 's/"0.1.0"/"0.2.0"/' "$dir/app/app.json"
git -C "$dir" commit -qam "bump"
write_receipt "$dir"
expect_refused "a version mismatch" "$dir" "not 0.1.0" 0.1.0

dir="$(fixture undated)"
sed -i 's/0.1.0 - 2026-01-01/0.1.0 - unreleased/' "$dir/CHANGELOG.md"
git -C "$dir" commit -qam "undate"
write_receipt "$dir"
expect_refused "an undated section" "$dir" "date the section" 0.1.0

dir="$(fixture tagged)"
git -C "$dir" tag -a v0.1.0 -m "already"
expect_refused "an existing tag" "$dir" "already exists" 0.1.0

dir="$(fixture smoke-fails)"
SMOKE_RC=1 expect_failed "a failing smoke" "$dir" "nothing was pushed" \
    0.1.0 --no-publish
case "$err" in
    *"the smoke failed"*) ;;
    *) fail "a failing smoke: stderr misses the smoke: $err" ;;
esac
[ -z "$(git -C "$dir" tag -l v0.1.0)" ] || fail "a failing smoke left the tag"
if grep -q 'gh release create' "$calls"; then
    fail "a failing smoke published: $(cat "$calls")"
fi

dir="$(fixture smoke-fail-line)"
SMOKE_FAILS=1 expect_failed "a FAIL line with exit 0" "$dir" "FAIL line" \
    0.1.0 --no-publish
if grep -q 'gh release create' "$calls"; then
    fail "a FAIL line published: $(cat "$calls")"
fi

dir="$(fixture release-smoke-fails)"
SMOKE_RC=1 expect_failed "a failing smoke in a release" "$dir" \
    "nothing was pushed" 0.1.0
if grep -q 'gh release create' "$calls"; then
    fail "a failing smoke made a release: $(cat "$calls")"
fi
[ -z "$(git -C "$dir" tag -l v0.1.0)" ] ||
    fail "a failing smoke left the local tag"
[ -z "$(git -C "$dir" ls-remote --tags origin v0.1.0)" ] ||
    fail "a failing smoke pushed the tag"

dir="$(fixture stale-main)"
printf 'A local commit.\n' >> "$dir/README.md"
git -C "$dir" commit -qam "a local commit"
write_receipt "$dir"
expect_refused "HEAD ahead of origin" "$dir" "HEAD is not origin/main" 0.1.0

dir="$(fixture remote-tag)"
git -C "$dir" tag -a v0.1.0 -m "elsewhere"
git -C "$dir" push -q origin v0.1.0
git -C "$dir" tag -d v0.1.0 >/dev/null
expect_refused "a tag on origin" "$dir" "already exists on origin" 0.1.0

dir="$(fixture rehearse)"
expect_ok "the rehearsal" "$dir" 0.1.0 --no-publish
case "$out" in
    *"rehearsal done"*) ;;
    *) fail "the rehearsal: no closing line: $out" ;;
esac
for file in "monkey-tasks-0.1.0.apk" "monkey-tasks-0.1.0.apk.sha256" \
    "release-notes.md" "BUILT_FROM" "smoke.log"; do
    [ -s "$dir/archive/$file" ] || fail "the rehearsal left no archive/$file"
done
[ -z "$(git -C "$dir" tag -l v0.1.0)" ] || fail "the rehearsal left the tag"
grep -q '^build ' "$calls" || fail "the rehearsal ran no build"
grep -q '^smoke ' "$calls" || fail "the rehearsal ran no smoke"
if grep -q 'gh release create' "$calls"; then
    fail "the rehearsal published: $(cat "$calls")"
fi

dir="$(fixture rehearse-branch)"
git -C "$dir" checkout -qb side
expect_ok "a rehearsal on a branch" "$dir" 0.1.0 --no-publish
expect_refused "a release on a branch" "$dir" "checkout main" 0.1.0
git -C "$dir" checkout -q main

dir="$(fixture publish)"
origin="$tmp/origin-publish.git"
expect_ok "a published release" "$dir" 0.1.0
case "$out" in
    *"is live at v0.1.0"*) ;;
    *) fail "a published release: no closing line: $out" ;;
esac
grep -q '^gh release create' "$calls" || fail "the release create did not run"
grep -q '^gh release download' "$calls" || fail "the download check did not run"
[ -n "$(git -C "$origin" rev-parse -q --verify refs/tags/v0.1.0)" ] ||
    fail "the tag did not reach origin"

printf 'release script: ok (%d cases)\n' "$assertions"

