#!/usr/bin/env bash
# Check that every CHANGELOG bullet fits one line on a phone.
# The changelog is the GitHub release body, read on the phone.
# A bullet fails if it runs past 64 characters or wraps onto
# a second line.
set -euo pipefail

file="${1:-CHANGELOG.md}"
max=64

awk -v max="$max" -v file="$file" '
  /^- / {
    inbullet = 1
    if (length($0) > max) {
      printf "%s:%d: bullet is %d characters, over %d\n", file, NR, length($0), max
      bad = 1
    }
    next
  }
  inbullet && /^  +[^ ]/ {
    printf "%s:%d: bullet wraps onto a second line\n", file, NR
    bad = 1
    next
  }
  { inbullet = 0 }
  END {
    if (bad) exit 1
    print "changelog bullets: ok"
  }
' "$file"
