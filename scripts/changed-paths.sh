#!/usr/bin/env bash
# Classify changed paths for the CI job filters.
set -euo pipefail

docs=false
code=false

while IFS= read -r path; do
    [ -n "$path" ] || continue
    case "$path" in
        *.md|docs/*|.vale/*|.vale.ini|.npmrc|Makefile|package.json|package-lock.json|.github/workflows/ci.yml) docs=true ;;
    esac
    case "$path" in
        *.md|docs/*|.vale.ini) ;;
        *) code=true ;;
    esac
done

printf 'docs=%s\ncode=%s\n' "$docs" "$code"
