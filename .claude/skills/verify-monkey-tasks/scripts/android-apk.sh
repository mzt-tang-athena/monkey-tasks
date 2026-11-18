#!/usr/bin/env bash
# Return a release APK for a checkout, fast when the native layer is
# unchanged. A swap takes the JS bundle and app.config from the checkout
# and puts them into a cached base APK, then aligns and signs it with the
# base's key. A miss runs the full build and caches its APK as the base.
#
#   android-apk.sh <checkout>          swap when the cache has a base
#   android-apk.sh <checkout> --full   always run the full build
#
# Never ship a swapped APK. A release builds with build-apk.sh and
# CLEAN=1, and a tagged commit forces the full path here.
#
# Env: APK_CACHE (default ~/code/monkey-tasks/apk-cache),
#      BUILD_APK (default android-build.sh next to this script),
#      SWAP_ON_TAG=1 to swap on a tagged commit.
#
# stdout is for scripts: mode, fingerprint, base, apk, seconds.
set -euo pipefail
source "$(dirname "$0")/android-env.sh"

usage() { sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
case "${1:-}" in ""|-h|--help) usage ;; esac

src=$(cd "$1" && pwd)
app=$src/app
out=$app/android/app/build/outputs/apk/release/app-release.apk
cache=${APK_CACHE:-$HOME/code/monkey-tasks/apk-cache}
build=${BUILD_APK:-$(cd "$(dirname "$0")" && pwd)/android-build.sh}
mode=swap
[ "${2:-}" = --full ] && mode=full

say() { echo "android-apk: $*" >&2; }
die() { echo "android-apk: $*" >&2; exit 1; }

[ -f "$app/package.json" ] || die "$app has no package.json"
[ -d "$app/node_modules" ] || die "run npm ci in $app first"
command -v python3 >/dev/null || die "python3 is needed to rewrite the APK"
bt=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
export PATH="$JAVA_HOME/bin:$bt:$PATH"
t0=$SECONDS

if [ "$mode" = swap ] && [ -z "${SWAP_ON_TAG:-}" ] && tag=$(git -C "$src" describe --tags --exact-match 2>/dev/null); then
  say "$tag is tagged, so this is a full build"
  mode=full
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/android-apk.XXXXXX")
trap 'rm -rf "$work"' EXIT

say "fingerprinting $app"
fp=$(cd "$app" && node -e 'require("@expo/fingerprint").createProjectHashAsync(process.cwd()).then((h) => process.stdout.write(h))')
[ -n "$fp" ] || die "no fingerprint"
say "fingerprint $fp"

say "exporting the JS bundle"
entry=$(cd "$app" && node -e "require('expo/scripts/resolveAppEntry')" "$app" android absolute)
mkdir -p "$work/assets"
flock -o /tmp/monkey-tasks-js-export.lock bash -c '
  cd "$1" && npx --no-install expo export:embed --platform android --dev false \
    --minify true --bytecode --entry-file "$2" \
    --bundle-output "$3" --sourcemap-output "$3.map" --assets-dest "$4"
' _ "$app" "$entry" "$work/index.android.bundle" "$work/assets" >"$work/export.log" 2>&1 \
  || { tail -20 "$work/export.log" >&2; die "the JS export failed"; }
[ -s "$work/index.android.bundle" ] || die "the JS export wrote no bundle"

say "resolving app.config"
node "$app/node_modules/expo-constants/scripts/getAppConfig.js" "$app" "$work" android false release
[ -s "$work/app.config" ] || die "no app.config"

asset_digest=$(cd "$work/assets" && { find . -type f -print0 | sort -z | xargs -0 -r sha256sum; } | sha256sum | cut -c1-16)
key=$fp-$asset_digest
keydir=$cache/$key
mkdir -p "$cache"

exec {lock}>"$cache/$key.lock"
flock -o "$lock"

if [ "$mode" = swap ] && [ ! -f "$keydir/base.apk" ]; then
  say "no base APK for $key, so this is a full build"
  mode=full
fi

if [ "$mode" = full ]; then
  [ -x "$build" ] || die "set BUILD_APK to the full build script, or put it at $build"
  flock /tmp/monkey-tasks-gradle.lock "$build" "$src" || die "the full build failed"
  [ -f "$out" ] || die "the full build left no APK at $out"
  mkdir -p "$keydir"
  cp "$out" "$keydir/base.apk.tmp"
  mv "$keydir/base.apk.tmp" "$keydir/base.apk"
  ks=$app/android/app/debug.keystore
  [ -f "$ks" ] || ks=$HOME/code/monkey-tasks/apk-builder/app/android/app/debug.keystore
  [ -f "$ks" ] || die "no signing key after the build"
  cp "$ks" "$cache/debug.keystore"
  printf '{"fingerprint":"%s","assets":"%s","commit":"%s","built":"%s"}\n' \
    "$fp" "$asset_digest" "$(git -C "$src" rev-parse --short HEAD)" "$(date -Is)" >"$keydir/meta.json"
else
  ks=$cache/debug.keystore
  [ -f "$ks" ] || ks=$app/android/app/debug.keystore
  [ -f "$ks" ] || die "no signing key, so run npx expo prebuild --platform android in $app"
  say "swapping the bundle into $keydir/base.apk"
  python3 - "$keydir/base.apk" "$work/unsigned.apk" "$work/index.android.bundle" "$work/app.config" <<'PY'
import sys, zipfile
base, out, bundle, appconfig = sys.argv[1:5]
replace = {"assets/index.android.bundle": bundle, "assets/app.config": appconfig}
data = {name: open(path, "rb").read() for name, path in replace.items()}
with zipfile.ZipFile(base) as src, zipfile.ZipFile(out, "w", allowZip64=True) as dst:
    for info in src.infolist():
        if info.filename in data:
            dst.writestr(info, data[info.filename])
        else:
            dst.writestr(info, src.read(info.filename), compress_type=info.compress_type)
PY
  zipalign -f -P 16 4 "$work/unsigned.apk" "$work/aligned.apk"
  apksigner sign --ks "$ks" --ks-pass pass:android --key-pass pass:android \
    --ks-key-alias androiddebugkey "$work/aligned.apk"
  apksigner verify "$work/aligned.apk" || die "the signature does not verify"
  signer() { apksigner verify --print-certs "$1" | sed -n 's/^V[0-9.]* Signer: certificate SHA-256 digest: //p' | head -1; }
  [ -n "$(signer "$work/aligned.apk")" ] || die "cannot read the new APK's signer"
  [ "$(signer "$work/aligned.apk")" = "$(signer "$keydir/base.apk")" ] \
    || die "$ks does not match the base APK's key"
  mkdir -p "$(dirname "$out")"
  cp "$work/aligned.apk" "$out"
fi

echo "mode: $mode"
echo "fingerprint: $fp"
echo "assets: $asset_digest"
if [ -f "$keydir/base.apk" ]; then echo "base: $keydir/base.apk"; fi
echo "apk: $out"
echo "seconds: $((SECONDS - t0))"
