#!/usr/bin/env bash
# Copy the shared files from project-template, or report the ones that differ.
# Run this with no flags to bring the repo up to date. `--dry-run` is what the
# fast gate runs, so the gate shows drift without blocking a pull request.
set -euo pipefail

usage() {
    cat <<'EOF'
usage: scripts/sync-template.sh [--dry-run] [--repo <path>]

  --dry-run     report the shared files that differ, and copy nothing
  --repo <path> the checkout to update; default: this repo

The shared paths live in scripts/template-files.txt, read from the template.
TEMPLATE_URL overrides the template remote. TEMPLATE_DIR reads a local
template checkout and skips the fetch. TEMPLATE_TIMEOUT bounds each network
call in seconds; the default is 20.
EOF
}

url="${TEMPLATE_URL:-git@github.com:mzt-tang-athena/project-template.git}"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/template-sync/project-template.git"
list_path="scripts/template-files.txt"

dry_run=false
target=""

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)
            dry_run=true
            ;;
        --repo)
            [ $# -ge 2 ] || { usage >&2; exit 2; }
            target=$2
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'template: unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

if [ -z "$target" ]; then
    target="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
[ -n "$target" ] || { echo "template: not in a git repo; pass --repo <path>" >&2; exit 2; }
target="$(cd "$target" && pwd -P)"
trap 'rm -f "$target"/.template-copy.*' EXIT

# No key prompt and no long wait, so a gate run stays quick when offline.
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o ConnectTimeout=5 -o BatchMode=yes}"

# The connect timeout does not cover a stall after the connect, so each
# network call also has a wall clock bound.
net_timeout="${TEMPLATE_TIMEOUT:-20}"

dir=""
ref=""

resolve() {
    if [ -n "${TEMPLATE_DIR:-}" ]; then
        dir="$(cd "$TEMPLATE_DIR" 2>/dev/null && pwd -P)" || return 1
        ref="$(git -C "$dir" rev-parse HEAD 2>/dev/null || true)"
        [ -n "$ref" ]
        return
    fi
    dir="$cache"
    if [ ! -d "$dir" ]; then
        if ! timeout "$net_timeout" git clone --bare --depth=1 --quiet \
            "$url" "$dir" >/dev/null 2>&1; then
            rm -rf "$dir"
            return 1
        fi
    fi
    timeout "$net_timeout" git -C "$dir" fetch --depth=1 --quiet \
        origin main >/dev/null 2>&1 || return 1
    ref="$(git -C "$dir" rev-parse FETCH_HEAD)"
}

is_template() {
    local origin
    origin="$(git -C "$target" remote get-url origin 2>/dev/null || true)"
    [ "${origin%.git}" = "${url%.git}" ] && return 0
    [ -n "$dir" ] && [ "$target" = "$dir" ]
}

# Targets whose recipe lives in template.mk. A repo that still holds its own
# copy of one gets a warning, because make keeps the last recipe silently.
shared_targets() {
    awk '/^[a-z][a-z0-9-]*:/ { name = $0; sub(/:.*/, "", name); next }
         /^\t/ { if (name != "") { print name; name = "" } }
         /^[^ \t]/ { name = "" }' "$1" | sort -u
}

if is_template; then
    printf 'template: this repo is the template; nothing to sync\n'
    exit 0
fi

if ! resolve; then
    if $dry_run; then
        printf 'template: skipped (cannot reach %s)\n' "$url"
        exit 0
    fi
    printf 'template: cannot reach %s\n' "$url" >&2
    exit 1
fi

if is_template; then
    printf 'template: this repo is the template at %s\n' "${ref:0:12}"
    exit 0
fi

list="$(git -C "$dir" cat-file -p "$ref:$list_path" 2>/dev/null || true)"
if [ -z "$list" ]; then
    if $dry_run; then
        printf 'template: skipped (no %s at %s)\n' "$list_path" "${ref:0:12}"
        exit 0
    fi
    printf 'template: no %s at %s\n' "$list_path" "${ref:0:12}" >&2
    exit 1
fi

printf 'template: project-template at %s\n' "${ref:0:12}"

added=0
updated=0
unchanged=0
absent=0

while IFS= read -r path; do
    path="${path%%#*}"
    path="$(printf '%s' "$path" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -n "$path" ] || continue
    case "$path" in
        /*|*..*)
            printf 'template: skip unsafe path: %s\n' "$path" >&2
            continue
            ;;
    esac
    if ! git -C "$dir" cat-file -e "$ref:$path" 2>/dev/null; then
        printf 'template: %s is not in the template at %s\n' "$path" "${ref:0:12}" >&2
        absent=$((absent + 1))
        continue
    fi
    file="$target/$path"
    if [ ! -e "$file" ]; then
        printf 'template: missing  %s\n' "$path"
        added=$((added + 1))
    elif git -C "$dir" cat-file -p "$ref:$path" | cmp -s - "$file"; then
        unchanged=$((unchanged + 1))
        continue
    else
        printf 'template: differs  %s\n' "$path"
        updated=$((updated + 1))
    fi
    if $dry_run; then
        continue
    fi
    mkdir -p "$(dirname "$file")"
    copy="$(mktemp "$target/.template-copy.XXXXXX")"
    git -C "$dir" cat-file -p "$ref:$path" > "$copy"
    case "$path" in
        *.sh) chmod +x "$copy" ;;
    esac
    mv -f "$copy" "$file"
done <<< "$list"

if $dry_run; then
    printf 'template: %d differ, %d missing, %d match\n' "$updated" "$added" "$unchanged"
    if [ "$added" -gt 0 ] || [ "$updated" -gt 0 ]; then
        printf 'template: run `make sync-template` to copy them\n'
    fi
else
    printf 'template: %d added, %d updated, %d unchanged\n' "$added" "$updated" "$unchanged"
fi

makefile="$target/Makefile"
if [ -f "$makefile" ]; then
    if ! grep -qx 'include template.mk' "$makefile"; then
        printf 'template: Makefile has no `include template.mk` line; add it\n'
    fi
    if [ -f "$target/template.mk" ]; then
        dupes="$(shared_targets "$target/template.mk" |
            while IFS= read -r name; do
                if grep -qE "^$name:" "$makefile"; then printf ' %s' "$name"; fi
            done)"
        if [ -n "$dupes" ]; then
            printf 'template: Makefile also defines%s; template.mk owns those recipes, so delete those blocks\n' "$dupes"
        fi
    fi
fi

# A list entry the template lost is a template bug. The gate warns; a sync fails.
if $dry_run; then
    exit 0
fi
[ "$absent" -eq 0 ]
