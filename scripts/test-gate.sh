#!/usr/bin/env bash
# Exercise gate.sh timings against a fake clock that moves on every read.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
gate="$here/gate.sh"
real_date="$(command -v date)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

# fixture <name> <step ms> builds a repo gate.sh can run, and a date that
# starts at 1763635200000 and moves <step ms> on every read of the clock.
fixture() {
    local name="$1" step_ms="$2"
    local dir="$tmp/$name"
    mkdir -p "$dir/repo/scripts" "$dir/bin" "$dir/state"
    cp "$gate" "$dir/repo/scripts/gate.sh"
    chmod +x "$dir/repo/scripts/gate.sh"
    printf 'ci:\n\t@true\n\nlint:\n\t@true\n\nweb-suite:\n\t@touch web-ran\n' \
        > "$dir/repo/Makefile"
    cat > "$dir/bin/date" <<EOF
#!/usr/bin/env bash
if [ "\${1:-}" = "+%s%3N" ]; then
    n=0
    [ -f "\$FAKE_CLOCK" ] && n="\$(cat "\$FAKE_CLOCK")"
    n=\$((n + 1))
    printf '%s' "\$n" > "\$FAKE_CLOCK"
    printf '%s\n' \$((1763635200000 + n * $step_ms))
    exit 0
fi
exec "$real_date" "\$@"
EOF
    chmod +x "$dir/bin/date"
    git -C "$dir/repo" init -q .
    git -C "$dir/repo" config user.email test@example.com
    git -C "$dir/repo" config user.name test
    git -C "$dir/repo" add -A
    git -C "$dir/repo" commit -qm init
    printf '%s\n' "$dir"
}

# run_gate <fixture dir> [gate args] runs a full gate and keeps its exit
# code and output. run_gate_fast does the same for a fast one.
run_gate() {
    local dir="$1" mode=full
    shift
    set +e
    out="$(cd "$dir/repo" && PATH="$dir/bin:$PATH" \
        FAKE_CLOCK="$dir/clock" LOCAL_GATE_STATE="$dir/state" \
        ./scripts/gate.sh "$mode" "$@" 2>&1)"
    code=$?
    set -e
}

run_gate_fast() {
    local dir="$1"
    shift
    set +e
    out="$(cd "$dir/repo" && PATH="$dir/bin:$PATH" \
        FAKE_CLOCK="$dir/clock" LOCAL_GATE_STATE="$dir/state" \
        ./scripts/gate.sh fast "$@" 2>&1)"
    code=$?
    set -e
}

receipt() {
    local file
    for file in "$1"/state/*.json; do
        [ -e "$file" ] || continue
        printf '%s\n' "$file"
        return
    done
}

# A clock that steps backward must not cost the receipt.
dir="$(fixture backward -700)"
run_gate "$dir" --no-status
[ "$code" -eq 0 ] || fail "backward clock: expected exit 0, got $code: $out"
assertions=$((assertions + 1))
file="$(receipt "$dir")"
[ -n "$file" ] || fail "backward clock: wrote no receipt: $out"
assertions=$((assertions + 1))
jq -e '.duration_s >= 0' "$file" >/dev/null \
    || fail "backward clock: duration_s is $(jq -c '.duration_s' "$file")"
assertions=$((assertions + 1))
jq -e '[.steps[].seconds] | all(. >= 0)' "$file" >/dev/null \
    || fail "backward clock: step seconds are $(jq -c '[.steps[].seconds]' "$file")"
assertions=$((assertions + 1))

# A clock that steps forward must still record positive timings.
dir="$(fixture forward 1000)"
run_gate "$dir" --no-status
[ "$code" -eq 0 ] || fail "forward clock: expected exit 0, got $code: $out"
assertions=$((assertions + 1))
file="$(receipt "$dir")"
[ -n "$file" ] || fail "forward clock: wrote no receipt: $out"
assertions=$((assertions + 1))
jq -e '.duration_s > 0' "$file" >/dev/null \
    || fail "forward clock: duration_s is $(jq -c '.duration_s' "$file")"
assertions=$((assertions + 1))
jq -e '[.steps[].seconds] | all(. > 0)' "$file" >/dev/null \
    || fail "forward clock: step seconds are $(jq -c '[.steps[].seconds]' "$file")"
assertions=$((assertions + 1))

# The status is a report. A repo with no GitHub origin warns, and the checks
# still decide the exit code.
dir="$(fixture no-origin 1000)"
run_gate "$dir"
[ "$code" -eq 0 ] || fail "no origin: expected exit 0, got $code: $out"
assertions=$((assertions + 1))
case "$out" in
    *'local-gate: warning: no github owner/repo in origin'*) ;;
    *) fail "no origin: did not warn: $out" ;;
esac
assertions=$((assertions + 1))
jq -e '.result == "pass"' "$(receipt "$dir")" >/dev/null \
    || fail "no origin: receipt is not a pass"
assertions=$((assertions + 1))

# A status post that the API rejects warns, and the pass stands.
dir="$(fixture gh-fails 1000)"
git -C "$dir/repo" remote add origin https://github.com/example/template.git
cat > "$dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
printf 'gh: HTTP 401: Bad credentials\n' >&2
exit 1
EOF
chmod +x "$dir/bin/gh"
run_gate "$dir"
[ "$code" -eq 0 ] || fail "failed post: expected exit 0, got $code: $out"
assertions=$((assertions + 1))
case "$out" in
    *'local-gate: warning: could not post the status'*) ;;
    *) fail "failed post: did not warn: $out" ;;
esac
assertions=$((assertions + 1))

# A failed check is still a failure when the post fails too.
dir="$(fixture check-fails 1000)"
git -C "$dir/repo" remote add origin https://github.com/example/template.git
printf 'ci:\n\t@exit 1\n' > "$dir/repo/Makefile"
git -C "$dir/repo" commit -qam "make ci fail"
cat > "$dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod +x "$dir/bin/gh"
run_gate "$dir"
[ "$code" -eq 1 ] || fail "failed check: expected exit 1, got $code: $out"
assertions=$((assertions + 1))
case "$out" in
    *'local-gate: full fail'*) ;;
    *) fail "failed check: did not report a fail: $out" ;;
esac
assertions=$((assertions + 1))

# A repo's scripts/gate-prelude.sh runs first in a full gate, with the
# gate's arguments. A fast gate stays out of it.
dir="$(fixture prelude 1000)"
cat > "$dir/repo/scripts/gate-prelude.sh" <<'EOF'
printf 'prelude args:%s\n' "$*"
EOF
git -C "$dir/repo" add -A
git -C "$dir/repo" commit -qm "add the prelude"
run_gate "$dir" --no-status
[ "$code" -eq 0 ] || fail "prelude: expected exit 0, got $code: $out"
assertions=$((assertions + 1))
case "$out" in
    *'prelude args:full --no-status'*) ;;
    *) fail "prelude: a full gate did not source it with its arguments: $out" ;;
esac
assertions=$((assertions + 1))
run_gate_fast "$dir" --no-status
[ "$code" -eq 0 ] || fail "prelude: a fast gate exited $code: $out"
case "$out" in
    *'prelude args'*) fail "prelude: a fast gate sourced the prelude: $out" ;;
esac
assertions=$((assertions + 1))

# The web suite rides CI where the workflow runs e2e-web and the repo is
# public. --web runs it here, and its receipt outranks a later plain run.
dir="$(fixture web-on-ci 1000)"
git -C "$dir/repo" remote add origin https://github.com/example/template.git
mkdir -p "$dir/repo/.github/workflows"
printf 'jobs:\n  e2e-web:\n    runs-on: ubuntu-latest\n' \
    > "$dir/repo/.github/workflows/ci.yml"
git -C "$dir/repo" add -A
git -C "$dir/repo" commit -qm "ci runs e2e-web"
cat > "$dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = api ] && [ "${2:-}" = repos/example/template ]; then
    printf 'false\n'
fi
exit 0
EOF
chmod +x "$dir/bin/gh"
run_gate "$dir"
[ "$code" -eq 0 ] || fail "web on CI: expected exit 0, got $code: $out"
assertions=$((assertions + 1))
jq -e '.web == false' "$(receipt "$dir")" >/dev/null ||
    fail "web on CI: the receipt says the web suite ran"
[ -e "$dir/repo/web-ran" ] && fail "web on CI: the gate ran the web suite"
assertions=$((assertions + 1))
case "$out" in
    *'CI runs the web suite for example/template'*) ;;
    *) fail "web on CI: no line about CI: $out" ;;
esac
assertions=$((assertions + 1))

run_gate "$dir" --web
[ "$code" -eq 0 ] || fail "web forced: expected exit 0, got $code: $out"
assertions=$((assertions + 1))
jq -e '.web == true' "$(receipt "$dir")" >/dev/null ||
    fail "web forced: the receipt says the web suite did not run"
[ -e "$dir/repo/web-ran" ] || fail "web forced: the web suite did not run"
assertions=$((assertions + 1))

rm -f "$dir/repo/web-ran"
run_gate "$dir"
case "$out" in
    *'the web suite ran on this tree'*) ;;
    *) fail "web kept: a plain run replaced the web receipt: $out" ;;
esac
assertions=$((assertions + 1))
jq -e '.web == true' "$(receipt "$dir")" >/dev/null ||
    fail "web kept: the receipt lost its web run"
assertions=$((assertions + 1))

# A repo whose workflow runs no e2e-web job runs the suite here.
dir="$(fixture no-web-job 1000)"
run_gate "$dir" --no-status
[ "$code" -eq 0 ] || fail "no web job: expected exit 0, got $code: $out"
[ -e "$dir/repo/web-ran" ] || fail "no web job: the gate skipped the web suite"
assertions=$((assertions + 1))

# A repo with no web-suite target runs as before: no web step, no CI line,
# and a receipt that says the suite did not run.
dir="$(fixture no-web-target 1000)"
printf 'ci:\n\t@true\n\nlint:\n\t@true\n' > "$dir/repo/Makefile"
git -C "$dir/repo" remote add origin https://github.com/example/template.git
mkdir -p "$dir/repo/.github/workflows"
printf 'jobs:\n  e2e-web:\n    runs-on: ubuntu-latest\n' \
    > "$dir/repo/.github/workflows/ci.yml"
git -C "$dir/repo" add -A
git -C "$dir/repo" commit -qm "no web suite"
cat > "$dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
printf 'false\n'
EOF
chmod +x "$dir/bin/gh"
run_gate "$dir" --no-status
[ "$code" -eq 0 ] || fail "no web target: expected exit 0, got $code: $out"
jq -e '.web == false and (.steps | map(.cmd) == ["make ci"])' "$(receipt "$dir")" >/dev/null ||
    fail "no web target: the receipt shows a web step"
case "$out" in
    *'CI runs the web suite'*) fail "no web target: the gate named a web suite: $out" ;;
esac
assertions=$((assertions + 1))

printf 'gate: %s assertions passed\n' "$assertions"
