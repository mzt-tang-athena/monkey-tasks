#!/usr/bin/env bash
# Run journeys against the instance on $VERIFY_PORT and keep the evidence.
# Usage: drive.sh <journey file or dir> [extra playwright args]
set -euo pipefail
source "$(dirname "$0")/env.sh"
target="$(realpath "${1:?usage: drive.sh <journey file or dir> [playwright args]}")"; shift
run="$EVIDENCE_ROOT/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run"
cd "$APP"
set +e
VERIFY_TARGET="$target" VERIFY_OUT="$run" E2E_BASE_URL="http://localhost:$PORT" \
  npx playwright test -c "$SKILL_DIR/scripts/verify.config.ts" "$@"
code=$?
set -e
echo "evidence: $run"
exit $code
