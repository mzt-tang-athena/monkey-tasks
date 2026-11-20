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
    printf 'ci:\n\t@true\n\nlint:\n\t@true\n' > "$dir/repo/Makefile"
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

# run_gate <fixture dir> [gate args] runs a gate and keeps its exit code
# and output.
run_gate() {
    local dir="$1"
    shift
    set +e
    out="$(cd "$dir/repo" && PATH="$dir/bin:$PATH" \
        FAKE_CLOCK="$dir/clock" LOCAL_GATE_STATE="$dir/state" \
        ./scripts/gate.sh full "$@" 2>&1)"
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

printf 'gate: %s assertions passed\n' "$assertions"
