#!/usr/bin/env bash
# Exercise sync-template.sh against a fixture template and a repo behind it.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sync="$here/sync-template.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assertions=0

fail() {
    printf 'FAIL: %s\n' "$1" >&2
    exit 1
}

pass() {
    assertions=$((assertions + 1))
}

# The real list must carry the files this mechanism needs to keep itself
# honest. A new shared file that nobody lists is invisible to the check.
for path in scripts/sync-template.sh scripts/template-files.txt template.mk; do
    grep -qx "$path" "$here/template-files.txt" \
        || fail "template-files.txt does not list $path"
    pass
done

template="$tmp/template"
repo="$tmp/repo"
mkdir -p "$template/scripts" "$repo/scripts"

printf '#!/usr/bin/env bash\necho new\n' > "$template/scripts/a.sh"
printf '#!/usr/bin/env bash\necho b\n' > "$template/scripts/b.sh"
printf 'lint: check-a\n\ncheck-a:\n\t@true\n' > "$template/template.mk"
printf 'scripts/a.sh\nscripts/b.sh\ntemplate.mk\n' > "$template/scripts/template-files.txt"
printf '#!/usr/bin/env bash\necho old\n' > "$repo/scripts/a.sh"
printf 'lint:\n\t@true\n\ncheck-a:\n\t@true\n' > "$repo/Makefile"

git -C "$template" init -q .
git -C "$template" add -A
git -C "$template" -c user.email=t@example.com -c user.name=t commit -qm init

run() {
    set +e
    out="$(TEMPLATE_DIR="$template" "$sync" "$@" --repo "$repo" 2>&1)"
    code=$?
    set -e
}

# A dry run reports both kinds of drift and writes nothing.
run --dry-run
[ "$code" -eq 0 ] || fail "dry run: expected exit 0, got $code: $out"
pass
case "$out" in
    *'differs  scripts/a.sh'*) pass ;;
    *) fail "dry run: did not name scripts/a.sh: $out" ;;
esac
case "$out" in
    *'missing  scripts/b.sh'*) pass ;;
    *) fail "dry run: did not name scripts/b.sh: $out" ;;
esac
case "$out" in
    *'1 differ, 2 missing, 0 match'*) pass ;;
    *) fail "dry run: wrong counts: $out" ;;
esac
case "$out" in
    *'make sync-template'*) pass ;;
    *) fail "dry run: did not name the fix: $out" ;;
esac
case "$out" in
    *'include template.mk'*) pass ;;
    *) fail "dry run: did not warn about the missing include: $out" ;;
esac
[ ! -e "$repo/scripts/b.sh" ] || fail "dry run: created scripts/b.sh"
pass
[ "$(cat "$repo/scripts/a.sh")" = '#!/usr/bin/env bash
echo old' ] || fail "dry run: changed scripts/a.sh"
pass

# A real run copies the bytes and the exec bit.
run
[ "$code" -eq 0 ] || fail "sync: expected exit 0, got $code: $out"
pass
cmp -s "$template/scripts/a.sh" "$repo/scripts/a.sh" || fail "sync: scripts/a.sh still differs"
pass
cmp -s "$template/scripts/b.sh" "$repo/scripts/b.sh" || fail "sync: scripts/b.sh not copied"
pass
[ -x "$repo/scripts/b.sh" ] || fail "sync: scripts/b.sh is not executable"
pass
cmp -s "$template/template.mk" "$repo/template.mk" || fail "sync: template.mk not copied"
pass
case "$out" in
    *'2 added, 1 updated, 0 unchanged'*) pass ;;
    *) fail "sync: wrong counts: $out" ;;
esac
case "$out" in
    *'also defines check-a'*) pass ;;
    *) fail "sync: did not warn about the duplicate target: $out" ;;
esac

# A second run changes nothing.
run
[ "$code" -eq 0 ] || fail "resync: expected exit 0, got $code: $out"
pass
case "$out" in
    *'0 added, 0 updated, 3 unchanged'*) pass ;;
    *) fail "resync: wrong counts: $out" ;;
esac
case "$out" in
    *'differs'*|*'missing'*) fail "resync: still reports drift: $out" ;;
    *) pass ;;
esac
case "$out" in
    *'also defines check-a'*) pass ;;
    *) fail "resync: lost the duplicate target warning: $out" ;;
esac

# A path the template lacks must not empty the repo's copy.
printf 'scripts/a.sh\nscripts/b.sh\nscripts/gone.sh\ntemplate.mk\n' \
    > "$template/scripts/template-files.txt"
printf 'keep me\n' > "$repo/scripts/gone.sh"
git -C "$template" add -A
git -C "$template" -c user.email=t@example.com -c user.name=t commit -qm gone
run
[ "$code" -ne 0 ] || fail "bad list: expected a non-zero exit, got $code: $out"
pass
[ -s "$repo/scripts/gone.sh" ] || fail "bad list: emptied scripts/gone.sh"
pass
case "$out" in
    *'not in the template'*) pass ;;
    *) fail "bad list: did not report the missing path: $out" ;;
esac

# An unreachable template is a skip, not a failure of the gate.
set +e
out="$(env -u TEMPLATE_DIR XDG_CACHE_HOME="$tmp/cache" TEMPLATE_URL="$tmp/nowhere" \
    "$sync" --dry-run --repo "$repo" 2>&1)"
code=$?
set -e
[ "$code" -eq 0 ] || fail "offline: expected exit 0, got $code: $out"
pass
case "$out" in
    *'skipped (cannot reach'*) pass ;;
    *) fail "offline: did not skip: $out" ;;
esac

# A clone that connects and then stalls must hit the bound, print the skip
# line, and leave no partial cache behind. The SSH connect timeout covers
# none of this, so the fetch needs its own wall clock bound.
hang="$tmp/hang"
mkdir -p "$hang/bin"
cat > "$hang/bin/git" <<EOF
#!/usr/bin/env bash
if [ "\${1:-}" = clone ]; then
    mkdir -p "\${@: -1}"
    exec sleep 30
fi
if [ "\${1:-}" = fetch ] || [ "\${2:-}" = fetch ] || [ "\${3:-}" = fetch ]; then
    exec sleep 30
fi
exec "$(command -v git)" "\$@"
EOF
chmod +x "$hang/bin/git"
start="$(date +%s)"
set +e
out="$(env -u TEMPLATE_DIR PATH="$hang/bin:$PATH" XDG_CACHE_HOME="$tmp/hang-cache" \
    TEMPLATE_URL="$tmp/nowhere" TEMPLATE_TIMEOUT=1 "$sync" --dry-run --repo "$repo" 2>&1)"
code=$?
set -e
elapsed=$(( $(date +%s) - start ))
[ "$code" -eq 0 ] || fail "stall: expected exit 0, got $code: $out"
pass
case "$out" in
    *'skipped (cannot reach'*) pass ;;
    *) fail "stall: did not skip: $out" ;;
esac
[ "$elapsed" -lt 10 ] || fail "stall: took ${elapsed}s; the fetch is unbounded"
pass
[ ! -e "$tmp/hang-cache/template-sync/project-template.git" ] \
    || fail "stall: left a partial cache behind"
pass

printf 'template sync: %s assertions passed\n' "$assertions"
