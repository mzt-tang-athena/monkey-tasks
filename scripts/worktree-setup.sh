#!/usr/bin/env bash
# Worktree setup for monkey-tasks. Run this once after a linked worktree
# is created, from anywhere in the worktree.
#
# The script is harness-independent: OpenChamber, Claude Code, or a human
# can call it. Every step checks before it writes, so a second run is
# cheap and safe.
set -euo pipefail

git_dir="$(cd "$(git rev-parse --git-dir)" && pwd -P)"
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
if [ "$git_dir" = "$common_dir" ]; then
    echo "worktree-setup: not a linked worktree; nothing to do"
    exit 0
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"

main_path="$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')"
worktree_name="$(basename "$root")"

link_modules() {
    local target=$1 source
    source="$main_path/$target"
    if [ -e "$target" ]; then
        echo "worktree-setup: $target already there"
        return 0
    fi
    if [ -d "$source" ]; then
        cp -al "$source" "$target"
        echo "worktree-setup: linked $target from $main_path"
    else
        echo "worktree-setup: $main_path has no $target; run npm ci here"
        return 1
    fi
}

# Hard links share the inodes, so this costs seconds instead of a full
# install. Dependencies stay read-only in a lane.
link_modules node_modules
link_modules app/node_modules

# The web suite launches a real Chromium, and the pinned runner wants one
# exact build. The shared browser cache can hold another, which fails the
# gate at launch. Ask the installed runner where its builds belong, then
# install only on a miss. A warm machine pays one second and no download.
ensure_browser() {
    local runner="$root/app/node_modules/.bin/playwright"
    local wanted path missing=""

    if [ ! -x "$runner" ]; then
        echo "worktree-setup: app/node_modules has no playwright; run npm ci here"
        return 1
    fi

    wanted="$("$runner" install chromium --dry-run | sed -n 's/^ *Install location: *//p')"
    while IFS= read -r path; do
        [ -n "$path" ] || continue
        [ -d "$path" ] || missing="$missing ${path##*/}"
    done <<< "$wanted"

    if [ -n "$wanted" ] && [ -z "$missing" ]; then
        echo "worktree-setup: playwright browsers present"
        return 0
    fi

    echo "worktree-setup: playwright missing${missing:- its pinned builds}; installing"
    "$runner" install chromium
    echo "worktree-setup: playwright browsers ready"
}

ensure_browser

# The contracts repository is private, so use https for this fetch.
git -c url."https://github.com/".insteadOf="git@github.com:" \
    submodule update --init
echo "worktree-setup: contracts checked out"

if [ ! -f contracts/packages/schemas/dist/index.js ]; then
    (cd app && npx tsc -p ../contracts/packages/schemas/tsconfig.build.json)
    echo "worktree-setup: schemas built"
else
    echo "worktree-setup: schemas already built"
fi

npx vale-rules sync
echo "worktree-setup: shared Vale rules synced"

# write-good is a clone, not a package. The Makefile fetches the pinned
# commit, so a fresh worktree never takes upstream's latest rules.
make -s ensure-styles
echo "worktree-setup: write-good styles ready"

git config --local core.hooksPath .githooks
echo "worktree-setup: core.hooksPath set to .githooks"

# One port per worktree, stable for the same path, so two lanes can run
# the preview at once. 8400 to 8599 stays clear of the e2e default
# (8094), the review agents (8200 to 8221) and the verify default (8300).
port="$(python3 - "$root" <<'PY'
import hashlib
import socket
import sys

path = sys.argv[1]
start = 8400 + int(hashlib.sha256(path.encode()).hexdigest(), 16) % 200
for offset in range(200):
    candidate = 8400 + (start - 8400 + offset) % 200
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", candidate))
        except OSError:
            continue
        print(candidate)
        break
else:
    raise SystemExit("worktree-setup: no free port in 8400-8599")
PY
)"

cat > .worktree.env <<EOF
export VERIFY_PORT=$port
EOF

echo "worktree-setup: $worktree_name ready, VERIFY_PORT=$port"
