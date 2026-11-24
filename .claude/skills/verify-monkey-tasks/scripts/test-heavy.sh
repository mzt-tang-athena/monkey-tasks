#!/usr/bin/env bash
# Tests for heavy.sh's lock handling and for the environment it forwards.
# A caller that already holds the lock must run in place instead of
# deadlocking on the unit's flock. A stranger's lock must still wait. No
# value of the caller's environment may reach an argv, and a private file
# must carry it instead, mode 600 until the unit has started. Every case
# runs under timeout, so a regression fails the gate instead of hanging
# it. The live-unit cases print a reason and skip where no user systemd
# runs, as in CI.
set -euo pipefail

scripts="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
holder=""
env_files=()

cleanup() {
    if [ -n "$holder" ]; then
        pkill -P "$holder" 2>/dev/null || true
        kill "$holder" 2>/dev/null || true
        wait "$holder" 2>/dev/null || true
    fi
    rm -f "${env_files[@]}"
    rm -rf "$tmp"
}
trap cleanup EXIT

fail() {
    printf 'test-heavy: %s\n' "$*" >&2
    exit 1
}

note_env_files() {
    local path
    while read -r path; do
        if [ -n "$path" ]; then
            env_files+=("$path")
        fi
    done < <(sed -n 's/^envfile \(.*\) mode .*/\1/p' <<<"$1")
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
for arg in "$@"; do
    case $arg in
        EnvironmentFile=*)
            file=${arg#EnvironmentFile=}
            printf 'envfile %s mode %s\n' "$file" \
                "$(stat -c %a "$file" 2>/dev/null || echo missing)"
            ;;
    esac
done
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
note_env_files "$out"

# An open fd without a lock is not a holder, so the job still queues.
bash -c 'exec 9>"$1"; sleep 20' _ "$MONKEY_HEAVY_LOCK_FILE" &
holder=$!
sleep 0.2
out="$(PATH="$tmp/bin:$PATH" timeout 20 "$tmp/probe.sh")" ||
    fail "an unlocked open fd broke the free-lock path"
grep -q '^stubbed systemd-run ' <<<"$out" ||
    fail "an open fd without a lock ran the job in place"
note_env_files "$out"
pkill -P "$holder" 2>/dev/null || true
kill "$holder" 2>/dev/null || true
wait "$holder" 2>/dev/null || true
holder=""

secret="fake-secret-$$-$RANDOM-not-a-real-secret"
odd_line="odd-line-$$-$RANDOM"
export HEAVY_PROBE_SECRET="$secret"
odd_value=$(printf '%s\n' \
    "$odd_line" \
    'quote "two", a $HOME, a `date` and a back\' \
    'end with \"quoted\" text and a backslash \')
export HEAVY_PROBE_ODD="$odd_value"
export CLEAN=1
export ARCHS=x86_64
export MONKEY_LOG_DIR="$tmp/logs"
export ANDROID_VERIFY_PORT=5584

out="$(PATH="$tmp/bin:$PATH" timeout 20 "$tmp/probe.sh")" ||
    fail "the forwarding case failed"
grep -qF -- "$secret" <<<"$out" &&
    fail "the secret reached the unit's argv"
grep -qF -- "$odd_line" <<<"$out" &&
    fail "a value reached the unit's argv"
note_env_files "$out"
env_file=$(sed -n 's/^envfile \(.*\) mode .*/\1/p' <<<"$out")
[ -n "$env_file" ] || fail "no environment file was passed: $out"
grep -q '^envfile .* mode 600$' <<<"$out" ||
    fail "the environment file was not mode 600: $out"
[ -e "$env_file" ] &&
    fail "the environment file outlived the systemd-run call"

# A unit that fails to start leaves no file behind.
mkdir -p "$tmp/failbin"
cat > "$tmp/failbin/systemd-run" <<'EOF'
#!/usr/bin/env bash
for arg in "$@"; do
    case $arg in
        EnvironmentFile=*) printf 'envfile %s\n' "${arg#EnvironmentFile=}" ;;
    esac
done
exit 1
EOF
chmod +x "$tmp/failbin/systemd-run"
rc=0
out="$(PATH="$tmp/failbin:$PATH" timeout 20 "$tmp/probe.sh" 2>&1)" || rc=$?
[ "$rc" -ne 0 ] || fail "a failing unit start returned zero"
env_file=$(sed -n 's/^envfile \(.*\)$/\1/p' <<<"$out")
[ -n "$env_file" ] || fail "no environment file on the failing path: $out"
env_files+=("$env_file")
[ -e "$env_file" ] &&
    fail "a failed unit start left the environment file behind"

# Live cases: only a real manager can prove these three.
if timeout 20 systemd-run --user --quiet --collect --wait --pipe -- /bin/true \
    </dev/null >/dev/null 2>&1; then
    cat > "$tmp/value-probe.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
. "$HEAVY_UNDER_TEST" value-probe
printf 'secret %s\n' \
    "$(printf '%s' "${HEAVY_PROBE_SECRET:-}" | sha256sum | cut -d' ' -f1)"
printf 'odd %s\n' \
    "$(printf '%s' "${HEAVY_PROBE_ODD:-}" | sha256sum | cut -d' ' -f1)"
printf 'knobs %s %s %s %s\n' "${CLEAN:-}" "${ARCHS:-}" \
    "${MONKEY_LOG_DIR:-}" "${ANDROID_VERIFY_PORT:-}"
: > "$HEAVY_TEST_STARTED"
tries=0
while [ ! -e "$HEAVY_TEST_GO" ]; do
    tries=$((tries + 1))
    [ "$tries" -lt 600 ] || { echo 'value-probe: no go' >&2; exit 9; }
    sleep 0.05
done
EOF
    chmod +x "$tmp/value-probe.sh"
    rm -f "$tmp/started" "$tmp/go"
    : > "$tmp/live.out"
    HEAVY_TEST_STARTED="$tmp/started" HEAVY_TEST_GO="$tmp/go" \
        timeout 60 "$tmp/value-probe.sh" >"$tmp/live.out" 2>&1 &
    holder=$!
    tries=0
    until [ -e "$tmp/started" ]; do
        tries=$((tries + 1))
        if [ "$tries" -ge 1200 ]; then
            kill "$holder" 2>/dev/null || true
            wait "$holder" 2>/dev/null || true
            holder=""
            fail "the live unit never started: $(cat "$tmp/live.out")"
        fi
        sleep 0.05
    done
    unit=$(sed -n 's/^unit: \(.*\) (MemoryMax=.*/\1/p' "$tmp/live.out")
    [ -n "$unit" ] || fail "no unit name on the live path"
    env_dir=${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}
    left=$(find "$env_dir" -maxdepth 1 \
        -name "monkey-heavy-env.$unit.*" -print -quit)
    [ -z "$left" ] ||
        fail "the environment file outlived the unit's start: $left"
    if grep -laF -- "$secret" /proc/[0-9]*/cmdline 2>/dev/null; then
        fail "the secret reached a command line while the job ran"
    fi
    if grep -laF -- "$odd_line" /proc/[0-9]*/cmdline 2>/dev/null; then
        fail "a value reached a command line while the job ran"
    fi
    : > "$tmp/go"
    wait "$holder" || { holder=""; fail "the live unit failed"; }
    holder=""
    want=$(printf '%s' "$HEAVY_PROBE_SECRET" | sha256sum | cut -d' ' -f1)
    grep -qx "secret $want" "$tmp/live.out" ||
        fail "the job did not see the caller's secret: $(cat "$tmp/live.out")"
    want=$(printf '%s' "$HEAVY_PROBE_ODD" | sha256sum | cut -d' ' -f1)
    if ! grep -qx "odd $want" "$tmp/live.out"; then
        fail "the odd value changed: $(cat "$tmp/live.out")"
    fi
    grep -qx "knobs 1 x86_64 $MONKEY_LOG_DIR 5584" "$tmp/live.out" ||
        fail "a forwarded knob did not reach the job: $(cat "$tmp/live.out")"
else
    printf 'test-heavy: skipped the live cases: no user systemd-run\n' >&2
fi

printf 'test-heavy: ok\n'
