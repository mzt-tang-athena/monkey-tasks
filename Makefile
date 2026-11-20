VALE_STYLES = .vale/styles
# Last good commit before upstream regenerated its rules on 2026-11-19.
WRITE_GOOD_SHA = c9ceca7f574248a201d5524b001099c5626c7519

.PHONY: lint ci typecheck eslint vitest web-suite ensure-styles hooks \
	check-docs check-records check-changelog check-changelog-entry \
	test-check-records

# What scripts/gate.sh runs for a prose-only branch. Vale reads only the
# markdown the branch changed, so the run stays quick.
lint: ensure-styles check-docs check-records check-changelog check-changelog-entry

# What scripts/gate.sh runs for code: the ci job's steps, then the web
# suite. The suite takes the heavy lock itself.
ci: typecheck eslint vitest lint web-suite

typecheck:
	cd app && npx tsc --noEmit

eslint:
	cd app && npx eslint src scripts e2e --max-warnings 0

vitest:
	cd app && npx vitest run

web-suite:
	.claude/skills/verify-monkey-tasks/scripts/web-suite.sh . "$$(git rev-parse --short=12 HEAD)" "$${GATE_E2E_PORT:-8094}"

ensure-styles:
	@[ -f $(VALE_STYLES)/write-good/Passive.yml ] || (git init -q $(VALE_STYLES)/write-good && git -C $(VALE_STYLES)/write-good fetch -q --depth=1 https://github.com/errata-ai/write-good $(WRITE_GOOD_SHA) && git -C $(VALE_STYLES)/write-good checkout -q FETCH_HEAD && cd $(VALE_STYLES)/write-good && if [ -d write-good ]; then mv write-good/* .; rmdir write-good; fi && find . -maxdepth 1 -name '*.yml' ! -name '*.rules.yml' | while read f; do grep -q extends $$f || rm $$f; done)

hooks:
	git config core.hooksPath .githooks
	@echo "pre-commit hook installed for this clone"

check-docs:
	@scripts/check-docs.sh

check-records:
	@scripts/check-records.sh

check-changelog:
	@scripts/check-changelog.sh

check-changelog-entry:
	@scripts/check-changelog-entry.sh

test-check-records:
	@bash scripts/test-check-records.sh
