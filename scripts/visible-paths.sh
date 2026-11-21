#!/usr/bin/env bash
# Print the changed paths a user can see, one per line, from paths on
# stdin. The screens, the assets and the app config count. Tests and
# fixtures stay out.
set -euo pipefail

while IFS= read -r path; do
    [ -n "$path" ] || continue
    case "$path" in
        app/src/*|app/assets/*|app/app.json) ;;
        *) continue ;;
    esac
    case "$path" in
        *.test.ts|*.test.tsx|app/src/testing/*|app/src/lib/vault/sample/*) continue ;;
    esac
    printf '%s\n' "$path"
done
