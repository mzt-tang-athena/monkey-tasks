---
id: 0053
title: The frontmatter parser reads what YAML reads
created: 2026-10-26
priority: high
assignee: claude-code
pr: 69
depends: []
---

## Spec

The app reads frontmatter with the small parser in the contracts repo
(`mzt-tang-athena/contracts`, the submodule at `contracts/`). It
disagrees with YAML in two places, and the app writes a file name rule
that loses the typed name. All three change what a user sees, and one
deletes data on save.

### Bug 1: list items at any indent but two spaces vanish

`contracts/packages/schemas/src/frontmatter.ts:25` reads a list item
only with exactly two spaces before the dash: `/^ {2}- (.*)$/`. YAML
also accepts no indent, four spaces, or a tab, and hand edits and other
tools write them. The app's own writer already accepts any indent
(`app/src/features/vault/notes.ts:156-164`).

Repro: a task note with

```yaml
lists:
    - "[[Focus]]"
```

reads as no lists, so the task leaves its Focus tab with no message.
Open it in the editor and save any change. The editor seeds its draft
from the parsed lists (`TaskEditorScreen.tsx:54`), so it saves an
empty list, and `saveTaskEdit` (`task-editor/save.ts:146-151`) deletes
the `lists` property. With no indent the save is worse: it removes the
`lists:` line and leaves the item behind, which breaks the note's
YAML.

Fix: a line that matches `/^[ \t]*- (.*)$/` is an item of the current
key when that key has no value on its own line or already holds a
list. Frontmatter stays flat, as today: a nested key is out of scope.

### Bug 2: a quoted value with an escape does not read back

The app's emitter (`app/src/lib/yaml.ts:46`) quotes with
`JSON.stringify`, so `"Dune" by Herbert` becomes
`"\"Dune\" by Herbert"`. The parser (`frontmatter.ts:54-56`) strips
the outer quotes and keeps the backslashes. The title then reads
`\"Dune\" by Herbert`, and each save adds more backslashes. The same
regex also strips a value that opens with one quote and closes with
the other.

Fix: decode a double-quoted value with YAML's escapes: at least `\\`,
`\"`, `\/`, `\n`, `\r`, `\t`, `\uXXXX`, `\xXX` and `\UXXXXXXXX`. In a
single-quoted value, `''` becomes `'` and nothing else changes. Strip
quotes only when both ends hold the same quote.

### Bug 3: a cleaned file name loses the typed name

ADR 0028 writes `title` when the provider renames a new note, for
example to `draw (1).md`. It does not cover the app's own cleaning:
`safeFileName` (`app/src/features/capture/write.ts:39-48`) turns
`/\:*?"<>|` into spaces and cuts a name at 80 characters. Capture
types "Pay bill: water", the file is `Pay bill water.md`, and
`createNote` (`app/src/features/vault/notes.ts:89-93`) writes no title,
because the provider kept the name it got. The row shows
"Pay bill: water" until the next read, then "Pay bill water". A rename
in the editor has the same gap (`task-editor/save.ts:102-104`).

Fix: write `title` when the final file name, without `.md`, differs
from the name the user typed. Add a dated amendment to ADR 0028 for the
wider rule. A note that gets a title this way is a titled note, so a
later rename in the editor changes the title, not the file
(`save.ts:154-162`).

After ticket 0050 these app files live under `app/src/lib/vault/`.
After ticket 0051, `createNote` and the rename go through the vault
adapter. Change the files where they are when you start.

### Repro tests

They are already in `app/src/testing/repro/parser.test.ts`, as
`it.fails`. Each asserts the behaviour we want, so it passes only while
the bug is there. A fix turns its test into a plain `it`.

| Bug | Repro test |
|---|---|
| 1 | "reads items with no indent", "reads items at four spaces", "reads items after a tab", "keeps a four-space list through an editor save" |
| 2 | "reads back a title that starts with a quote", "reads back a quoted title that holds a backslash" |
| 3 | "shows the typed name after the next read" |

### Steps

1. A PR in `mzt-tang-athena/contracts` fixes bugs 1 and 2 in
   `packages/schemas/src/frontmatter.ts`, with tests in
   `packages/schemas/test/`. Merge it when its checks pass.
2. A PR here into `epic/0047-rebuild` moves the `contracts` submodule
   to that merge commit and flips the bug 1 and bug 2 repro tests.
3. The same PR, or a second one, fixes bug 3 in the app and flips its
   repro test.

## Acceptance

- [x] Each bug had its repro test in `app/src/testing/repro/parser.test.ts`
      before its fix, as `it.fails`.
- [x] Every test in `app/src/testing/repro/parser.test.ts` runs as a
      plain `it` and passes.
- [x] The contracts tests cover list items at no indent, two spaces,
      four spaces and a tab, and all read `["[[Focus]]"]`.
- [x] The contracts tests cover each escape in the bug 2 list and a
      single-quoted `''`.
- [x] A value with a quote at one end only keeps its quote.
- [x] Every value `serializeValue` writes reads back unchanged, for a
      list of tricky titles in an app test.
- [ ] The `vault:check` tests show no parser disagreement for a note
      with list items at no indent, four spaces, or a tab.
- [x] An editor save on a note with a four-space list keeps the list.
- [x] A capture of "Pay bill: water" shows "Pay bill: water" after the
      next read.
- [x] ADR 0028 has a dated amendment for the wider title rule.
- [ ] The contracts PR is merged, and the submodule points at its
      merge commit.

## Outcome

Landed in PR #69 into `epic/0047-rebuild`, with contracts PR #1
(`mzt-tang-athena/contracts`).

- **Contracts.** The parser reads list items at any indent and decodes
  YAML's escapes. Quotes come off only when both ends match. Where
  YAML refuses a note, the parser keeps the text as written. Contracts
  ADR 0002 records that choice and the rejected YAML library. 48 new
  tests cover the indents, each escape, single quotes and one-sided
  quotes.
- **Bug 1.** `updateProperty` also finds items with no indent, so an
  editor save keeps a list at any indent and leaves no item behind.
- **Bug 2.** `serializeValue` escapes every character YAML refuses raw.
  31 tricky titles round-trip through the app's parser and `js-yaml`.
- **Bug 3.** `keepTypedName` writes `title` when the final file name
  differs from the typed name: on a capture, on a rename, and on an
  editor save with no rename. ADR 0028 has the amendment.
- **vault:check** finds a list item's key at any indent. A note that
  `js-yaml` cannot parse is reported at the line where it stopped.

Each repro test failed on the old parser or the old title rule before
it passed. The typed-name test reads the folder back through
`loadTasks`, the same path as the app's next read.

Left open, on purpose or for others:

- The `vault:check` line is not ticked. No indent and four spaces read
  the same in the app and in `js-yaml`. A tab still gives a finding.
  YAML forbids a tab in indentation, so `js-yaml` and Obsidian cannot
  read the note. The check reports it at the tab's line, and ADR 0029
  has an amendment for the choice.
- The contracts PR merge is the reviewer's step. After the merge, move
  the `contracts` submodule from the PR head (`f87f877`) to the merge
  commit. Contracts CI cannot run on that private repo while Actions
  is blocked on billing, so its gates ran locally: 74 passed and 1
  skipped, typecheck clean, and no prose alerts.
- The web preview cannot show the typed name after a read. Its mock
  store never writes or reads a note, so the preview looks the same
  before and after this ticket. Ticket 0051 gives the preview a memory
  adapter, and it now carries an acceptance line for "Pay bill: water"
  after a refresh.
- The phone pass for capture, rename and editor save waits for the
  epic's dev client build.
