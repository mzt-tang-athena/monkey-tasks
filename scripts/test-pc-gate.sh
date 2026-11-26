#!/usr/bin/env bash
# Exercise pc-gate.sh against stub ssh and scp. The stubs keep a fake PC
# under $dir/pc and log every call, so a test can see what ran and what
# was left behind.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pc_gate="$here/pc-gate.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

ok() {
    assertions=$((assertions + 1))
}

# fixture <name> builds a repo with a bare origin, a pushed commit, the
# script under test, a stub gate.sh that records its arguments, and stub
# ssh and scp on PATH. $dir/pc is the PC's Windows drive.
fixture() {
    local name="$1"
    local dir="$tmp/$name"
    mkdir -p "$dir/repo/scripts" "$dir/bin" "$dir/state" "$dir/pc"
    cp "$pc_gate" "$dir/repo/scripts/pc-gate.sh"
    chmod +x "$dir/repo/scripts/pc-gate.sh"
    cat > "$dir/repo/scripts/gate.sh" <<'EOF'
#!/usr/bin/env bash
printf 'local gate ran: %s\n' "$*"
exit "${STUB_LOCAL_RC:-0}"
EOF
    chmod +x "$dir/repo/scripts/gate.sh"
    git init -q --bare "$dir/origin.git"
    git -C "$dir/repo" init -q -b main .
    git -C "$dir/repo" config user.email test@example.com
    git -C "$dir/repo" config user.name test
    git -C "$dir/repo" add -A
    git -C "$dir/repo" commit -qm init
    git -C "$dir/repo" remote add origin "$dir/origin.git"
    git -C "$dir/repo" push -q origin main

    cat > "$dir/bin/scp" <<'EOF'
#!/usr/bin/env bash
printf 'scp %s\n' "$*" >> "$STUB_DIR/calls.log"
[ -z "${STUB_SCP_FAIL:-}" ] || { echo "scp: Could not resolve hostname" >&2; exit 255; }
args=()
while [ $# -gt 0 ]; do
    case "$1" in
        -o) shift ;;
        -*) ;;
        *) args+=("$1") ;;
    esac
    shift
done
map() {
    local path=$1
    case "$path" in
        *:*) path="${path#*:}"; printf '%s/pc/%s\n' "$STUB_DIR" "${path//:/}" ;;
        *) printf '%s\n' "$path" ;;
    esac
}
src="$(map "${args[0]}")"
dst="$(map "${args[1]}")"
mkdir -p "$(dirname "$dst")"
cp "$src" "$dst"
EOF
    cat > "$dir/bin/ssh" <<'EOF'
#!/usr/bin/env bash
printf 'ssh %s\n' "$*" >> "$STUB_DIR/calls.log"
cmd="${*: -1}"
case "$cmd" in
    *' bash '*) [ -z "${STUB_SSH_DROP:-}" ] || { echo "client_loop: send disconnect" >&2; exit 255; } ;;
esac
public="$STUB_DIR/pc/C/Users/Public"
case "$cmd" in
    *' rm -f '*)
        for path in ${cmd#* rm -f }; do rm -f "$public/$(basename "$path")"; done
        ;;
    *' bash '*)
        set -- ${cmd#* bash }
        script="$public/$(basename "$1")"
        sha=$2
        [ -f "$script" ] || { echo "no runner at $script" >&2; exit 3; }
        bash -n "$script" || exit 4
        echo "pc-gate: fetching ${sha:0:12}"
        echo "npm warn deprecated something"
        echo "local-gate: full ${STUB_PC_RESULT:-pass}: ${sha:0:12}"
        printf '{"repo":"monkey-tasks","sha":"%s","result":"%s","dirty":false}\n' \
            "$sha" "${STUB_PC_RESULT:-pass}" > "$public/monkey-tasks--$sha.json"
        echo "pc-gate: receipt monkey-tasks--$sha.json"
        exit "${STUB_PC_RC:-0}"
        ;;
esac
EOF
    chmod +x "$dir/bin/scp" "$dir/bin/ssh"
    printf '%s\n' "$dir"
}

# run_pc <fixture dir> [args] keeps the exit code and output in $code and
# $out. Stub switches ride in the environment.
run_pc() {
    local dir="$1"
    shift
    set +e
    out="$(cd "$dir/repo" && PATH="$dir/bin:$PATH" STUB_DIR="$dir" \
        LOCAL_GATE_STATE="$dir/state" ./scripts/pc-gate.sh "$@" 2>&1)"
    code=$?
    set -e
}

calls() {
    cat "$1/calls.log" 2>/dev/null || true
}

left_on_pc() {
    find "$1/pc" -type f 2>/dev/null | sed "s|^$1/pc/||"
}

# A pass copies the receipt home under the PC's own name, streams the
# summary lines, keeps the noise in the log, and leaves the PC clean.
dir="$(fixture pass)"
sha="$(git -C "$dir/repo" rev-parse HEAD)"
run_pc "$dir" origin/main
[ "$code" -eq 0 ] || fail "pass: expected exit 0, got $code: $out"
ok
jq -e --arg sha "$sha" '.sha == $sha and .result == "pass"' \
    "$dir/state/monkey-tasks--$sha.json" >/dev/null ||
    fail "pass: no receipt at the exact name: $(ls "$dir/state")"
ok
case "$out" in
    *'pc-gate: fetching'*'local-gate: full pass'*) ;;
    *) fail "pass: did not stream the summary lines: $out" ;;
esac
ok
case "$out" in
    *'npm warn'*) fail "pass: printed a noise line: $out" ;;
esac
grep -q 'npm warn' "$dir/state/pc-gate-${sha:0:12}.log" ||
    fail "pass: the log lost the full output"
ok
[ -z "$(left_on_pc "$dir")" ] || fail "pass: left files on the PC: $(left_on_pc "$dir")"
ok
case "$(calls "$dir")" in
    *'scp '*'C/Users/Public/pc-gate-run-'*|*'scp '*':C:/Users/Public/pc-gate-run-'*) ;;
    *) fail "pass: never staged the runner: $(calls "$dir")" ;;
esac
case "$(calls "$dir")" in
    *' gorillapc'*) ;;
    *) fail "pass: PC_HOST did not default to gorillapc: $(calls "$dir")" ;;
esac
ok
[ -z "$(find "$dir/state" -type f ! -name 'monkey-tasks--*' ! -name 'pc-gate-*.log')" ] ||
    fail "pass: stray files in the state dir: $(ls -A "$dir/state")"
ok

# A failing gate on the PC is a failing run. The fail receipt still comes
# home, and the PC is still cleaned.
dir="$(fixture gate-fails)"
sha="$(git -C "$dir/repo" rev-parse HEAD)"
STUB_PC_RC=1 STUB_PC_RESULT=fail run_pc "$dir" "$sha"
[ "$code" -eq 1 ] || fail "gate fails: expected exit 1, got $code: $out"
ok
jq -e '.result == "fail"' "$dir/state/monkey-tasks--$sha.json" >/dev/null ||
    fail "gate fails: the fail receipt did not come home"
ok
[ -z "$(left_on_pc "$dir")" ] || fail "gate fails: left files on the PC: $(left_on_pc "$dir")"
ok

# PC_HOST picks the host.
dir="$(fixture host)"
PC_HOST=otherpc run_pc "$dir" main
[ "$code" -eq 0 ] || fail "host: expected exit 0, got $code: $out"
case "$(calls "$dir")" in
    *'otherpc:'*) ;;
    *) fail "host: scp never named otherpc: $(calls "$dir")" ;;
esac
ok

# A host that cannot be reached falls back to the local gate on the same
# commit, and says so.
dir="$(fixture no-host)"
sha="$(git -C "$dir/repo" rev-parse HEAD)"
STUB_SCP_FAIL=1 PC_HOST=nohost.invalid run_pc "$dir" origin/main
[ "$code" -eq 0 ] || fail "no host: expected exit 0, got $code: $out"
case "$out" in
    *'pc-gate: cannot reach nohost.invalid (scp failed); running the gate here'*) ;;
    *) fail "no host: no fallback line: $out" ;;
esac
case "$out" in
    *"local gate ran: full --sha $sha"*) ;;
    *) fail "no host: the local gate did not run on the sha: $out" ;;
esac
ok

# An ssh that drops after the runner went over falls back and cleans the PC.
dir="$(fixture ssh-drops)"
sha="$(git -C "$dir/repo" rev-parse HEAD)"
STUB_SSH_DROP=1 run_pc "$dir" origin/main
[ "$code" -eq 0 ] || fail "ssh drops: expected exit 0, got $code: $out"
case "$out" in
    *'pc-gate: cannot reach gorillapc (ssh dropped); running the gate here'*) ;;
    *) fail "ssh drops: no fallback line: $out" ;;
esac
case "$out" in
    *"local gate ran: full --sha $sha"*) ;;
    *) fail "ssh drops: the local gate did not run: $out" ;;
esac
[ -z "$(left_on_pc "$dir")" ] || fail "ssh drops: left files on the PC: $(left_on_pc "$dir")"
ok

# The fallback's exit code is the local gate's.
dir="$(fixture fallback-fails)"
STUB_SCP_FAIL=1 STUB_LOCAL_RC=1 run_pc "$dir" origin/main
[ "$code" -eq 1 ] || fail "fallback fails: expected exit 1, got $code: $out"
ok

# A commit origin lacks is refused before any ssh or scp.
dir="$(fixture unpushed)"
git -C "$dir/repo" commit -q --allow-empty -m "local only"
run_pc "$dir" HEAD
[ "$code" -eq 2 ] || fail "unpushed: expected exit 2, got $code: $out"
case "$out" in
    *'origin does not have'*) ;;
    *) fail "unpushed: no refusal line: $out" ;;
esac
[ -z "$(calls "$dir")" ] || fail "unpushed: called the PC anyway: $(calls "$dir")"
ok

# An unknown ref is refused the same way, and so is a missing one.
dir="$(fixture unknown)"
run_pc "$dir" no-such-ref
[ "$code" -eq 2 ] || fail "unknown ref: expected exit 2, got $code: $out"
[ -z "$(calls "$dir")" ] || fail "unknown ref: called the PC anyway"
ok
run_pc "$dir"
[ "$code" -eq 2 ] || fail "no ref: expected exit 2, got $code: $out"
[ -z "$(calls "$dir")" ] || fail "no ref: called the PC anyway"
ok

printf 'test-pc-gate: %s assertions passed\n' "$assertions"
