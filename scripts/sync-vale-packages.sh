#!/usr/bin/env bash
# Fetch the Vale packages named in .vale.ini.
# It downloads only when the Packages line or the extracted styles change,
# so a later URL bump reaches every machine that already synced.
set -euo pipefail

config="${1:-.vale.ini}"
stamp=".vale/packages.stamp"
styles=".vale/styles/write-good"

[ -f "$config" ] || { echo "vale packages: no $config" >&2; exit 1; }

packages="$(sed -n 's/^[[:space:]]*Packages[[:space:]]*=[[:space:]]*//p' "$config")"
# A repo that still clones write-good has no Packages line. Skipping keeps
# the shared lint chain working there until it takes the package.
[ -n "$packages" ] || { echo "vale packages: no Packages line in $config; skipped"; exit 0; }

have_styles() {
    [ -d "$styles" ] || return 1
    [ -n "$(find "$styles" -maxdepth 1 -name '*.yml' -print -quit)" ]
}

if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$packages" ] && have_styles; then
    echo "vale packages: synced"
    exit 0
fi

command -v vale >/dev/null || { echo "vale is not installed; see README.md" >&2; exit 1; }

vale sync
mkdir -p "$(dirname "$stamp")"
printf '%s\n' "$packages" > "$stamp"
echo "vale packages: fetched $packages"
