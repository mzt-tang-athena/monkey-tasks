# The shared part of every repo's Makefile.
# project-template owns this file. Run `make sync-template` to take a new
# version, and never edit it in a repo.

# Git hands these to every hook, pointing at the repository that started the
# hook. A worktree push would then send each recipe's git command there.
unexport GIT_DIR GIT_WORK_TREE GIT_IMPLICIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE
unexport GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE
unexport GIT_PREFIX GIT_SHALLOW_FILE GIT_GRAFT_FILE

.PHONY: check-template sync-template test-template-sync check-secrets \
	check-records sync-packages test-check-records test-check-tickets \
	test-gate test-git-env

# The warning rides first so it shows even when a later check fails.
lint: check-template check-secrets check-records sync-packages test-git-env

check-template:
	@scripts/sync-template.sh --dry-run

sync-template:
	@scripts/sync-template.sh

test-template-sync:
	@bash scripts/test-template-sync.sh

check-secrets:
	@scripts/check-secrets.sh

check-records:
	@scripts/check-records.sh
	@scripts/check-tickets.sh

# Vale fetches the Packages named in .vale.ini. The script skips the download
# unless that line changed, so lint runs offline and a bump still lands.
# A repo with no Packages line skips too: it still clones write-good.
sync-packages:
	@scripts/sync-vale-packages.sh

test-check-records:
	@bash scripts/test-check-records.sh

test-check-tickets:
	@bash scripts/test-check-tickets.sh

test-gate:
	@bash scripts/test-gate.sh

test-git-env:
	@bash scripts/test-git-env.sh
