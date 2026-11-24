#!/usr/bin/env bash
# Tests for heavy.sh's lock handling. A caller that already holds the
# lock must run in place instead of deadlocking on the unit's flock. A
# stranger's lock must still wait. Every case runs under timeout, so a
# regression fails the gate instead of hanging it.
set -euo pipefail

scripts="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
holder=""

cleanup() {
    if [ -n "$holder" ]; then
        pkill -P "$holder" 2>/dev/null || true
        kill "$holder" 2>/dev/null || true
        wait "$holder" 2>/dev/null || true
    fi
    rm -rf "$tmp"
}
trap cleanup EXIT

fail() {
    printf 'test-heavy: %s\n' "$*" >&2
    exit 1
}

unset MONKEY_HEAVY_LOCK MONKEY_HEAVY_UNIT
export MONKEY_HEAVY_LOCK_FILE="$tmp/heavy.lock"
export HEAVY_UNDER_TEST="$scripts/heavy.sh"

cat > "$tmp/probe.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
. "$HEAVY_UNDER_TEST" probe
printf 'probe body %s\n' "$BASHPID"
EOF
chmod +x "$tmp/probe.sh"

# A parent holding the lock runs the job in place, with no unit.
out="$(timeout 20 flock -o "$MONKEY_HEAVY_LOCK_FILE" "$tmp/probe.sh")" ||
    fail "a parent's lock did not run the job in place"
grep -q 'running in place' <<<"$out" ||
    fail "no in-place line: $out"
grep -q '^probe body ' <<<"$out" ||
    fail "the job did not run: $out"
grep -q '^unit: ' <<<"$out" &&
    fail "a parent's lock still started a unit"

# The same holds when the holder sits further up the tree.
out="$(timeout 20 flock -o "$MONKEY_HEAVY_LOCK_FILE" \
    bash -c 'bash "$1"' _ "$tmp/probe.sh")" ||
    fail "a grandparent's lock did not run the job in place"
grep -q '^probe body ' <<<"$out" ||
    fail "a grandparent's lock did not run the job: $out"

# A stranger holding the lock still waits: the unit branch blocks.
flock -o "$MONKEY_HEAVY_LOCK_FILE" sleep 20 &
holder=$!
tries=0
until ! flock -n "$MONKEY_HEAVY_LOCK_FILE" true 2>/dev/null; do
    tries=$((tries + 1))
    [ "$tries" -lt 100 ] || fail "the test's own holder never took the lock"
    sleep 0.1
done
rc=0
MONKEY_HEAVY_UNIT=1 timeout 5 "$tmp/probe.sh" \
    >"$tmp/stranger.out" 2>&1 || rc=$?
[ "$rc" -eq 124 ] || fail "a stranger's lock did not wait (exit $rc)"
grep -q 'probe body' "$tmp/stranger.out" &&
    fail "the job ran past a stranger's lock"
pkill -P "$holder" 2>/dev/null || true
kill "$holder" 2>/dev/null || true
wait "$holder" 2>/dev/null || true
holder=""

# Once the stranger lets go, the same command runs.
out="$(MONKEY_HEAVY_UNIT=1 timeout 20 "$tmp/probe.sh")" ||
    fail "the job did not run after the stranger released the lock"
grep -q '^probe body ' <<<"$out" ||
    fail "the job did not run after release: $out"

# With no holder, the job still defers to a unit that takes the lock.
mkdir -p "$tmp/bin"
cat > "$tmp/bin/systemd-run" <<'EOF'
#!/usr/bin/env bash
printf 'stubbed systemd-run %s\n' "$*"
EOF
chmod +x "$tmp/bin/systemd-run"
out="$(PATH="$tmp/bin:$PATH" timeout 20 "$tmp/probe.sh")" ||
    fail "the free-lock path failed"
grep -q '^stubbed systemd-run ' <<<"$out" ||
    fail "a free lock did not start a unit"
grep -q 'MONKEY_HEAVY_UNIT=1' <<<"$out" ||
    fail "the unit does not take the lock"
grep -q 'running in place' <<<"$out" &&
    fail "a free lock ran in place"
grep -q '^probe body ' <<<"$out" &&
    fail "a free lock ran the job instead of queueing it"

# An open fd without a lock is not a holder, so the job still queues.
bash -c 'exec 9>"$1"; sleep 20' _ "$MONKEY_HEAVY_LOCK_FILE" &
holder=$!
sleep 0.2
out="$(PATH="$tmp/bin:$PATH" timeout 20 "$tmp/probe.sh")" ||
    fail "an unlocked open fd broke the free-lock path"
grep -q '^stubbed systemd-run ' <<<"$out" ||
    fail "an open fd without a lock ran the job in place"
pkill -P "$holder" 2>/dev/null || true
kill "$holder" 2>/dev/null || true
wait "$holder" 2>/dev/null || true
holder=""

printf 'test-heavy: ok\n'
