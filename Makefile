VALE_STYLES = .vale/styles
# Last good commit before upstream regenerated its rules on 2026-11-19.
WRITE_GOOD_SHA = c9ceca7f574248a201d5524b001099c5626c7519

.PHONY: lint ensure-styles hooks check-records check-changelog test-check-records

lint: check-records check-changelog ensure-styles
	npx vale-rules sync
	vale README.md docs/adr/*.md tickets/README.md

ensure-styles:
	@[ -f $(VALE_STYLES)/write-good/Passive.yml ] || (git init -q $(VALE_STYLES)/write-good && git -C $(VALE_STYLES)/write-good fetch -q --depth=1 https://github.com/errata-ai/write-good $(WRITE_GOOD_SHA) && git -C $(VALE_STYLES)/write-good checkout -q FETCH_HEAD && cd $(VALE_STYLES)/write-good && if [ -d write-good ]; then mv write-good/* .; rmdir write-good; fi && find . -maxdepth 1 -name '*.yml' ! -name '*.rules.yml' | while read f; do grep -q extends $$f || rm $$f; done)

hooks:
	git config core.hooksPath .githooks
	@echo "pre-commit hook installed for this clone"

check-records:
	@scripts/check-records.sh

check-changelog:
	@scripts/check-changelog.sh

test-check-records:
	@bash scripts/test-check-records.sh
