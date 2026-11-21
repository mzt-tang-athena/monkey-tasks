#!/usr/bin/env bash
# Exercise check-release-notes.sh against fixture repositories and a
# stand-in gh. Each fixture PR is one squash commit.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
checker="$here/check-release-notes.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bin="$tmp/bin"
mkdir -p "$bin"
cat > "$bin/gh" <<'EOF'
#!/usr/bin/env bash
body="${GH_PRS:?}"
expr=""
while [ $# -gt 0 ]; do
    case "$1" in
        --jq) expr=$2; shift ;;
        --json) shift ;;
    esac
    shift
done
if [ -n "$expr" ]; then jq -r "$expr" "$body"; else cat "$body"; fi
EOF
chmod +x "$bin/gh"

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

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
        printf 'export const value = 1;\n' > app/src/app.ts
        printf '# Changelog\n' > CHANGELOG.md
        printf 'Words.\n' > README.md
        git add -A
        git commit -qm base
    )
}

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

prs_for() {
    local number="$1" title="$2" sha="$3"
    jq -n --argjson number "$number" --arg title "$title" --arg sha "$sha" \
        '[{number: $number, title: $title, mergeCommit: {oid: $sha}, url: ""}]' \
        > "$tmp/prs.json"
}

check() {
    local dir="$1"
    shift
    set +e
    out="$(cd "$dir" && PATH="$bin:$PATH" GH_PRS="$tmp/prs.json" "$checker" "$@" 2>"$tmp/err")"
    code=$?
    set -e
    err="$(cat "$tmp/err")"
}

pass_case() {
    local label="$1" dir="$2" want="$3"
    shift 3
    check "$dir" "$@"
    [ "$code" -eq 0 ] || fail "$label: expected exit 0, got $code; stderr: $err"
    case "$out" in
        *"$want"*) ;;
        *) fail "$label: stdout does not name $want: $out" ;;
    esac
    assertions=$((assertions + 1))
}

fail_case() {
    local label="$1" dir="$2"
    shift 2
    check "$dir" "$@"
    [ "$code" -eq 1 ] || fail "$label: expected exit 1, got $code; stderr: $err"
    case "$err" in
        *"has no changelog line"*) ;;
        *) fail "$label: stderr misses the finding: $err" ;;
    esac
    case "$err" in
        *"changed visible app code without a line"*) ;;
        *) fail "$label: stderr misses the reason: $err" ;;
    esac
    assertions=$((assertions + 1))
}

visible="$tmp/visible"
new_repo "$visible"
since="$(git -C "$visible" rev-parse HEAD)"
printf 'export const value = 2;\n' > "$visible/app/src/app.ts"
commit_in "$visible" "Change the value"
sha="$(git -C "$visible" rev-parse HEAD)"
prs_for 7 "Change the value" "$sha"
fail_case "visible change without a line" "$visible" --since "$since"
case "$err" in
    *'#7 has no changelog line'*) ;;
    *) fail "visible change: stderr misses the PR: $err" ;;
esac
case "$err" in
    *'app/src/app.ts'*) ;;
    *) fail "visible change: stderr misses the path: $err" ;;
esac

covered="$tmp/covered"
new_repo "$covered"
since="$(git -C "$covered" rev-parse HEAD)"
printf 'export const value = 2;\n' > "$covered/app/src/app.ts"
printf -- '- A new value.\n' >> "$covered/CHANGELOG.md"
commit_in "$covered" "Change the value"
sha="$(git -C "$covered" rev-parse HEAD)"
prs_for 8 "Change the value" "$sha"
pass_case "visible change with a line" "$covered" "1 merged PRs since" --since "$since"

escaped="$tmp/escaped"
new_repo "$escaped"
since="$(git -C "$escaped" rev-parse HEAD)"
printf 'export const value = 2;\n' > "$escaped/app/src/app.ts"
commit_in "$escaped" "Refactor the value|Changelog: none"
sha="$(git -C "$escaped" rev-parse HEAD)"
prs_for 9 "Refactor the value" "$sha"
pass_case "trailer escape" "$escaped" "0 without a line" --since "$since"

test_only="$tmp/test-only"
new_repo "$test_only"
since="$(git -C "$test_only" rev-parse HEAD)"
printf 'export const value = 3;\n' > "$test_only/app/src/app.test.ts"
commit_in "$test_only" "Test the value"
sha="$(git -C "$test_only" rev-parse HEAD)"
prs_for 10 "Test the value" "$sha"
pass_case "test-only change" "$test_only" "1 without a line" --since "$since"
case "$err" in
    *'changed no app code a user can see'*) ;;
    *) fail "test-only change: stderr misses the non-visible note: $err" ;;
esac

before="$tmp/before"
new_repo "$before"
since="$(git -C "$before" rev-parse HEAD)"
prs_for 11 "The base" "$since"
pass_case "a PR at or before the tag is skipped" "$before" "0 merged PRs since" --since "$since"

other="$tmp/other"
new_repo "$other"
since="$(git -C "$other" rev-parse HEAD)"
base_branch="$(git -C "$other" symbolic-ref --short HEAD)"
git -C "$other" checkout -qb side
printf 'export const value = 4;\n' > "$other/app/src/app.ts"
commit_in "$other" "A branch not merged"
off="$(git -C "$other" rev-parse HEAD)"
git -C "$other" checkout -q "$base_branch"
prs_for 12 "A branch not merged" "$off"
pass_case "an unmerged PR is skipped" "$other" "0 merged PRs since" --since "$since"

printf 'release notes check: ok (%d cases)\n' "$assertions"
