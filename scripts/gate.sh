#!/usr/bin/env bash
# Local gate: run this repo's CI steps and leave a receipt keyed by HEAD.
# The status post is a report. A failed post warns, and the checks set the
# exit code.
set -euo pipefail

usage() {
    cat <<'EOF'
usage: scripts/gate.sh [fast|full] [--web] [--sha <sha>] [--no-status]

  fast        run make lint
  full        run make ci, else make lint then make check
  --web       run the web suite here too, even where CI runs it
  --sha       require this commit to be HEAD with a clean tree
  --no-status skip the local-gate commit status

With no mode, the changed paths against origin/main pick one. Prose only
means fast. Anything else means full.

A repo with a web-suite make target gets the suite in a full gate. The
gate leaves it to CI when the workflow runs an e2e-web job and the repo is
public, because those minutes cost nothing. --web runs it here anyway.

A repo may add scripts/gate-prelude.sh. A full gate sources it with the
gate's arguments before any step runs. The prelude may run the gate again
somewhere else, such as a capped unit or a lock, and then exit.
EOF
}

refuse() {
    local reason=$1
    local line
    line="$(date -u +%Y-%m-%dT%H:%M:%SZ) repo=$repo requested=${requested_sha:-none} head=$head reason=$reason"
    printf '%s\n' "$line" >> "$state_dir/refusals.log"
    printf 'local-gate: refused: %s\n' "$reason" >&2
    exit 2
}

now_ms() {
    date +%s%3N
}

seconds_from_ms() {
    local ms=$1
    if [ "$ms" -lt 0 ]; then ms=0; fi
    printf '%d.%03d' "$((ms / 1000))" "$((ms % 1000))"
}

has_target() {
    make -n "$1" >/dev/null 2>&1
}

# The web suite rides CI where that costs nothing: a public repo whose
# workflow runs e2e-web. Any doubt runs it here, and --web forces it.
ci_carries_web() {
    local workflow="$root/.github/workflows/ci.yml"
    [ -n "$slug" ] || return 1
    [ -f "$workflow" ] || return 1
    grep -qE '^  e2e-web:' "$workflow" || return 1
    command -v gh >/dev/null 2>&1 || return 1
    [ "$(gh api "repos/$slug" --jq .private 2>/dev/null)" = false ] || return 1
}

mode=""
requested_sha=""
post_status=true
web_requested=false
gate_args=("$@")

while [ $# -gt 0 ]; do
    case "$1" in
        fast|full)
            mode=$1
            ;;
        --web)
            web_requested=true
            ;;
        --sha)
            [ $# -ge 2 ] || { usage >&2; exit 2; }
            requested_sha=$2
            shift
            ;;
        --no-status)
            post_status=false
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'local-gate: unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

root="$(git rev-parse --show-toplevel)"
cd "$root"

head="$(git rev-parse HEAD)"
remote="$(git remote get-url origin 2>/dev/null || true)"
case "$remote" in
    git@github.com:*) slug="${remote#git@github.com:}" ;;
    https://github.com/*) slug="${remote#https://github.com/}" ;;
    ssh://git@github.com/*) slug="${remote#ssh://git@github.com/}" ;;
    *) slug="" ;;
esac
slug="${slug%.git}"
repo="${slug##*/}"
[ -n "$repo" ] || repo="$(basename "$root")"

state_dir="${LOCAL_GATE_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/local-gate}"
mkdir -p "$state_dir"

dirty=false
if [ -n "$(git status --porcelain)" ]; then dirty=true; fi

if [ -n "$requested_sha" ]; then
    resolved="$(git rev-parse --verify "${requested_sha}^{commit}" 2>/dev/null || true)"
    [ "$resolved" = "$head" ] || refuse "sha $requested_sha is not HEAD ($head)"
    if $dirty; then refuse "tree is dirty"; fi
fi

base="$(git merge-base origin/main HEAD 2>/dev/null || true)"
if [ -n "$base" ]; then
    changed="$(git diff --name-only "$base" 2>/dev/null || true)"
else
    changed="$(git diff --name-only HEAD 2>/dev/null || true)"
fi
untracked="$(git ls-files --others --exclude-standard 2>/dev/null || true)"
changed="$(printf '%s\n%s\n' "$changed" "$untracked" | sed '/^$/d' | sort -u)"

if [ -z "$mode" ]; then
    if [ -z "$changed" ]; then
        mode=full
    else
        code="$(printf '%s\n' "$changed" | scripts/changed-paths.sh | sed -n 's/^code=//p')"
        if [ "$code" = false ]; then mode=fast; else mode=full; fi
    fi
fi

steps=()
web=false
if [ "$mode" = fast ]; then
    if has_target lint; then steps+=("make lint"); fi
else
    if has_target ci; then
        steps+=("make ci")
    else
        if has_target lint; then steps+=("make lint"); fi
        if has_target check; then steps+=("make check"); fi
    fi
    if has_target web-suite; then
        if $web_requested || ! ci_carries_web; then
            web=true
            steps+=("make web-suite")
        else
            printf 'local-gate: CI runs the web suite for %s; pass --web to run it here\n' "$slug"
        fi
    fi
fi

prelude="$root/scripts/gate-prelude.sh"
if [ "$mode" = full ] && [ -f "$prelude" ]; then
    . "$prelude" "${gate_args[@]+"${gate_args[@]}"}"
fi

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
run_start="$(now_ms)"
steps_json='[]'
result=pass
step_count=${#steps[@]}

if [ "$step_count" -eq 0 ]; then
    result=fail
    steps_json="$(jq -cn --arg cmd "(none)" --argjson rc 1 --argjson seconds 0 \
        '{cmd: $cmd, rc: $rc, seconds: $seconds}')"
    step_count=1
    printf 'local-gate: no %s steps found\n' "$mode" >&2
else
    for cmd in ${steps[@]+"${steps[@]}"}; do
        step_start="$(now_ms)"
        rc=0
        bash -o pipefail -c "$cmd" || rc=$?
        step_end="$(now_ms)"
        seconds="$(seconds_from_ms "$((step_end - step_start))")"
        steps_json="$(jq -cn --argjson acc "$steps_json" --arg cmd "$cmd" \
            --argjson rc "$rc" --argjson seconds "$seconds" \
            '$acc + [{cmd: $cmd, rc: $rc, seconds: $seconds}]')"
        if [ "$rc" -ne 0 ]; then
            result=fail
            break
        fi
    done
fi

duration_s="$(seconds_from_ms "$(( $(now_ms) - run_start ))")"

receipt="$state_dir/$repo--$head.json"
rank() {
    case "$1" in
        fast) printf 1 ;;
        full) printf 2 ;;
        *) printf 0 ;;
    esac
}

final_mode=$mode
final_result=$result
prev_mode=""
prev_dirty=true
prev_web=false
if [ -f "$receipt" ]; then
    prev_mode="$(jq -r '.mode // empty' "$receipt" 2>/dev/null || true)"
    prev_dirty="$(jq -r 'if .dirty == false then "false" else "true" end' "$receipt" 2>/dev/null || printf true)"
    prev_web="$(jq -r 'if .web == true then "true" else "false" end' "$receipt" 2>/dev/null || printf false)"
fi

keep=false
keep_why=""
if [ -n "$prev_mode" ]; then
    if [ "$prev_dirty" = false ] && [ "$dirty" = true ]; then
        keep=true
        keep_why="clean beats dirty"
    elif [ "$prev_dirty" = "$dirty" ] && [ "$(rank "$prev_mode")" -gt "$(rank "$mode")" ]; then
        keep=true
        keep_why="higher mode wins"
    elif [ "$prev_dirty" = "$dirty" ] && [ "$(rank "$prev_mode")" -eq "$(rank "$mode")" ] &&
        [ "$prev_web" = true ] && ! $web; then
        keep=true
        keep_why="the web suite ran on this tree"
    fi
fi

if $keep; then
    final_mode=$prev_mode
    final_result="$(jq -r '.result // "fail"' "$receipt")"
    step_count="$(jq -r '.steps | length' "$receipt")"
    duration_s="$(jq -r '.duration_s' "$receipt")"
    prev_label=clean
    if [ "$prev_dirty" = true ]; then prev_label=dirty; fi
    cur_label=clean
    if [ "$dirty" = true ]; then cur_label=dirty; fi
    printf 'local-gate: kept the %s %s receipt for %s over this %s %s run (%s)\n' \
        "$prev_label" "$prev_mode" "${head:0:12}" "$cur_label" "$mode" "$keep_why"
else
    tmp="$(mktemp "$state_dir/.receipt.XXXXXX")"
    changed_json="$(printf '%s\n' "$changed" | jq -R -s 'split("\n") | map(select(length > 0))')"
    jq -n \
        --arg repo "$repo" \
        --arg sha "$head" \
        --arg mode "$mode" \
        --argjson dirty "$dirty" \
        --argjson web "$web" \
        --arg started_at "$started_at" \
        --argjson duration_s "$duration_s" \
        --argjson changed_files "$changed_json" \
        --argjson steps "$steps_json" \
        --arg result "$result" \
        '{repo: $repo, sha: $sha, mode: $mode, dirty: $dirty,
          web: $web, started_at: $started_at, duration_s: $duration_s,
          changed_files: $changed_files, steps: $steps,
          result: $result}' > "$tmp"
    mv -f "$tmp" "$receipt"
fi

printf 'local-gate: %s %s: %s (%s step(s), %ss)\n' \
    "$final_mode" "$final_result" "${head:0:12}" "$step_count" "$duration_s"
printf 'local-gate: receipt %s\n' "$receipt"

if $post_status; then
    receipt_dirty="$(jq -r 'if .dirty == false then "false" else "true" end' "$receipt")"
    if [ "$receipt_dirty" = true ]; then
        printf 'local-gate: receipt was written on a dirty tree; skipped the status\n' >&2
    elif [ "$dirty" = true ]; then
        printf 'local-gate: this run started on a dirty tree; skipped the status\n' >&2
    else
        final_steps="$(jq -r '.steps | length' "$receipt")"
        state=success
        description="$final_mode: $final_steps step(s) passed"
        if [ "$final_result" != pass ]; then
            state=failure
            description="$final_mode: $final_steps step(s), failed"
        fi
        if [ -z "$slug" ]; then
            printf 'local-gate: warning: no github owner/repo in origin; skipped the status\n' >&2
        elif gh api --method POST "repos/$slug/statuses/$head" \
            -f state="$state" \
            -f context=local-gate \
            -f description="$description" >/dev/null; then
            printf 'local-gate: posted %s on %s\n' "$state" "${head:0:12}"
        else
            printf 'local-gate: warning: could not post the status; the checks decide the exit code\n' >&2
        fi
    fi
fi

[ "$final_result" = pass ]
