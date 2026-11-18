#!/bin/bash
# One heavy job at a time on this 15 GB machine: builds, full e2e runs and
# emulator passes all queue on one lock. -o keeps children from holding it.
if [ -z "${MONKEY_HEAVY_LOCK:-}" ]; then exec env MONKEY_HEAVY_LOCK=1 flock -o /tmp/monkey-tasks-heavy.lock "$0" "$@"; fi
# Build the release APK for the checkout in $1, and leave it at
# $1/app/android/app/build/outputs/apk/release/app-release.apk.
# The build runs in one shared builder folder, so Gradle and CMake reuse
# the native outputs of the last build. CLEAN=1 builds in place from
# scratch instead, for a release, for every CPU type. A proof build
# targets only the emulator's x86_64; set ARCHS to change that.
set -o pipefail
logs=${MONKEY_LOG_DIR:-/tmp/monkey-tasks}
mkdir -p "$logs"
export JAVA_HOME=$HOME/Android/jdk ANDROID_HOME=$HOME/Android/Sdk
src=$(cd "$1" && pwd) || exit 1
echo "start $(date +%T) $(git -C "$src" rev-parse --short HEAD) clean=${CLEAN:-0}"
if [ "${CLEAN:-0}" = 1 ]; then
  work=$src
else
  work=$HOME/code/monkey-tasks/apk-builder
  mkdir -p "$work"
  rsync -a --delete --exclude=/.git --exclude=/app/android --exclude=/app/build --exclude=/app/dist \
    --exclude=/node_modules --exclude=/app/node_modules "$src"/ "$work"/ || { echo "sync failed"; exit 1; }
  for nm in node_modules app/node_modules; do
    rsync -a --delete --link-dest="$src/$nm" "$src/$nm"/ "$work/$nm"/ || { echo "sync $nm failed"; exit 1; }
  done
fi
cd "$work/app" || exit 1
npx expo prebuild --platform android --no-install > "$logs/prebuild.log" 2>&1 || { echo "prebuild failed"; exit 1; }
archs=()
[ "${CLEAN:-0}" = 1 ] || archs=(-PreactNativeArchitectures="${ARCHS:-x86_64}")
cd android && ./gradlew assembleRelease --no-daemon "${archs[@]}" > "$logs/gradle.log" 2>&1
rc=$?
echo "end $(date +%T) exit $rc"
out=app/build/outputs/apk/release
if [ $rc -eq 0 ] && [ "$work" != "$src" ]; then
  mkdir -p "$src/app/android/$out" && cp "$out/app-release.apk" "$src/app/android/$out/app-release.apk" || rc=1
fi
ls -la "$src/app/android/$out/" 2>/dev/null
exit $rc
