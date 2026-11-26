#!/usr/bin/env bash
# Run the full gate on the operator's PC and bring the receipt home.
# gate.sh stays the one gate definition. This script only stages a ref
# there, runs gate.sh on it, and copies the receipt to the same name in
# the local state dir, so pr-land reads it unchanged. It pushes nothing.
set -euo pipefail

usage() {
    cat <<'EOF'
usage: scripts/pc-gate.sh <ref>

  <ref>       a commit, branch or tag that origin already has

Runs `scripts/gate.sh full` on the PC over ssh and copies the receipt
back to the local-gate state dir. The PC posts the GitHub status itself.
PC_HOST names the host and defaults to gorillapc. A host that cannot be
reached runs `scripts/gate.sh full --sha <sha>` here instead.
EOF
}

pc_distro=Ubuntu
pc_repo=/root/src/monkey-tasks
pc_win_dir=C:/Users/Public
pc_wsl_dir=/mnt/c/Users/Public

say() {
    printf 'pc-gate: %s\n' "$*"
}

refuse() {
    printf 'pc-gate: refused: %s\n' "$1" >&2
    exit 2
}

case "${1:-}" in
    -h|--help) usage; exit 0 ;;
    "") usage >&2; exit 2 ;;
esac
[ $# -eq 1 ] || { usage >&2; exit 2; }
ref=$1

root="$(git rev-parse --show-toplevel)"
cd "$root"

sha="$(git rev-parse --verify "${ref}^{commit}" 2>/dev/null)" || refuse "unknown ref: $ref"
git fetch -q origin 2>/dev/null || true
[ -n "$(git for-each-ref --count=1 --contains "$sha" refs/remotes/origin)" ] ||
    refuse "origin does not have ${sha:0:12}; push the branch first"

host="${PC_HOST:-gorillapc}"
state_dir="${LOCAL_GATE_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/local-gate}"
mkdir -p "$state_dir"

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10 -o LogLevel=ERROR)
run_name="pc-gate-run-${sha:0:12}-$$.sh"
log="$state_dir/pc-gate-${sha:0:12}.log"
runner="$(mktemp)"
trap 'rm -f "$runner"' EXIT

write_runner() {
    cat > "$runner" <<'RUNNER'
#!/usr/bin/env bash
set -euo pipefail
sha=$1
repo=$2
public=$3

export PATH="/root/.local/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"

say() { printf 'pc-gate: %s\n' "$*"; }

# npm ci runs when the lockfile differs from the one the modules were
# installed from, or the modules are gone.
install_modules() {
    local dir=$1 want have=""
    want="$(sha256sum "$dir/package-lock.json" | cut -d' ' -f1)"
    [ -f "$dir/node_modules/.pc-gate-lock" ] && have="$(cat "$dir/node_modules/.pc-gate-lock")"
    if [ -d "$dir/node_modules" ] && [ "$have" = "$want" ]; then
        say "$dir modules current"
        return 0
    fi
    say "$dir npm ci"
    (cd "$dir" && npm ci --no-audit --no-fund --loglevel=error)
    printf '%s\n' "$want" > "$dir/node_modules/.pc-gate-lock"
}

cd "$repo"
say "fetching ${sha:0:12}"
git fetch -q origin
git checkout -q --force --detach "$sha"
git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init contracts
install_modules contracts
install_modules app
say "building schemas"
(cd app && npx tsc -p ../contracts/packages/schemas/tsconfig.build.json)
say "syncing vale"
(cd app && npx vale-rules sync --styles ../.vale/styles)
scripts/sync-vale-packages.sh

say "gating ${sha:0:12}"
rc=0
scripts/gate.sh full --sha "$sha" || rc=$?

state="${LOCAL_GATE_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/local-gate}"
receipt="$(ls "$state"/*--"$sha".json 2>/dev/null | head -n 1 || true)"
if [ -n "$receipt" ]; then
    cp -f "$receipt" "$public/$(basename "$receipt")"
    say "receipt $(basename "$receipt")"
fi
exit "$rc"
RUNNER
}

pc_run() {
    ssh "${ssh_opts[@]}" "$host" "wsl -d $pc_distro -u root -e $*"
}

fall_back() {
    local rc=0
    say "cannot reach $host ($1); running the gate here"
    "$root/scripts/gate.sh" full --sha "$sha" || rc=$?
    exit "$rc"
}

clean_pc() {
    pc_run rm -f "$pc_wsl_dir/$run_name" "$pc_wsl_dir/${receipt_name:-$run_name.none}" >/dev/null 2>&1 ||
        say "warning: could not remove $run_name from $host"
}

write_runner
if ! scp -q "${ssh_opts[@]}" "$runner" "$host:$pc_win_dir/$run_name" 2>/dev/null; then
    fall_back "scp failed"
fi

say "running ${sha:0:12} on $host, full log $log"
set +e
pc_run bash "$pc_wsl_dir/$run_name" "$sha" "$pc_repo" "$pc_wsl_dir" 2>&1 |
    sed -u 's/\r$//' | tee "$log" |
    grep --line-buffered -E '^(pc-gate|local-gate):'
code=${PIPESTATUS[0]}
set -e

receipt_name="$(sed -n 's/^pc-gate: receipt //p' "$log" | tail -n 1)"

if [ "$code" -eq 255 ]; then
    clean_pc
    fall_back "ssh dropped"
fi

status=$code
if [ -n "$receipt_name" ]; then
    case "$receipt_name" in
        *--"$sha".json) ;;
        *) receipt_name=""; say "warning: the PC named an unexpected receipt" ;;
    esac
fi
if [ -n "$receipt_name" ]; then
    tmp="$(mktemp "$state_dir/.receipt.XXXXXX")"
    if scp -q "${ssh_opts[@]}" "$host:$pc_win_dir/$receipt_name" "$tmp" 2>/dev/null &&
        jq -e --arg sha "$sha" '.sha == $sha' "$tmp" >/dev/null 2>&1; then
        mv -f "$tmp" "$state_dir/$receipt_name"
        say "receipt $state_dir/$receipt_name"
    else
        rm -f "$tmp"
        say "could not copy the receipt back from $host"
        [ "$status" -ne 0 ] || status=1
    fi
else
    say "the PC left no receipt; the full log is $log"
    [ "$status" -ne 0 ] || status=1
fi

clean_pc

if [ "$status" -ne 0 ]; then
    printf 'pc-gate: last lines of %s\n' "$log" >&2
    tail -n 25 "$log" >&2
fi
exit "$status"
