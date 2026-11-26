include template.mk

.PHONY: lint ci typecheck eslint vitest web-suite hooks check-docs \
	check-changelog check-changelog-entry test-pre-commit test-release test-heavy

# What scripts/gate.sh runs for a prose-only branch. Vale reads only the
# markdown the branch changed, so the run stays quick.
lint: check-docs check-changelog check-changelog-entry

# What scripts/gate.sh runs for code: the ci job's steps. The web suite
# rides CI, which runs e2e-web for free on this public repo, so a PR's
# gate leaves it out. `scripts/gate.sh full --web` runs it here, and a
# lane still needs it when CI is down.
ci: typecheck eslint vitest lint test-pre-commit test-release test-heavy

typecheck:
	cd app && npx tsc --noEmit

eslint:
	cd app && npx eslint src scripts e2e --max-warnings 0

vitest:
	cd app && npx vitest run

web-suite:
	.claude/skills/verify-monkey-tasks/scripts/web-suite.sh . "$$(git rev-parse --short=12 HEAD)" "$${GATE_E2E_PORT:-8094}"

hooks:
	git config core.hooksPath .githooks
	@echo "pre-commit hook installed for this clone"

check-docs:
	@scripts/check-docs.sh

check-changelog:
	@scripts/check-changelog.sh

check-changelog-entry:
	@scripts/check-changelog-entry.sh

test-pre-commit:
	@bash scripts/test-pre-commit.sh

test-release:
	@bash scripts/test-check-release-notes.sh
	@bash scripts/test-release.sh

# heavy.sh decides whether a caller already holds the heavy lock, so a
# regression here hangs every heavy job instead of failing it.
test-heavy:
	@bash .claude/skills/verify-monkey-tasks/scripts/test-heavy.sh
