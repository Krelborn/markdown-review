# Changes since your last submit

## Problem

After a Revise round the agent edits the doc and the browser re-renders it in place. Nothing marks what changed. On a plan several screens long, on a 14-inch laptop, the reviewer rereads everything or trusts the agent's resolve messages.

Evidence in the code: a doc's threads file holds only `sourceHash` (`documentThreadsFileSchema.ts`), a hash that exists to detect re-anchoring needs (`hashSource.ts`). No earlier source is kept anywhere, so there is nothing to diff against. `App.tsx` handles `onDocumentChanged` with `documentSource.refresh()` and nothing else.

## Options

1. **Baseline taken on submit, block-level diff (chosen).** Snapshot a doc's source when a Revise submit sends comments on it. Diff `parseBlocks` output of baseline against current. Costs a new store directory and one endpoint. Risk: only the last round is covered.
2. **Baseline taken on open.** No hook in submit, but "open" is not "the user last saw it": a reopened or reconnected session silently resets the baseline, and the first round has nothing. Rejected.
3. **Keep every round's snapshot, or use git.** Allows "changes since round N" and survives multiple rounds, but the doc may be uncommitted, committed by the agent mid-round, or outside git history, and the UI needs a version picker. More than the 14-inch second-round reader needs. Possible follow-up.

## Design

**Baseline.** In `ReviewStore.submit`, when the verdict is `revise`, write the current source of each doc that received a submitted message to `.markdown-review/baselines/<doc path>` (raw markdown, same path layout as `documentThreadsFilePath`, new helper in `storePaths.ts`, written through `StoreFiles`). Each Revise submit overwrites it, so the baseline is always the doc as it stood at the last submit. Go-ahead and hand-back leave it alone. Docs never submitted have no baseline and show no control. A doc the user submitted nothing on keeps its older baseline; it simply shows changes since then. Raw source rather than blocks means no schema, and `storeFileVersion` is untouched. The `documents/` listing is unaffected because baselines live in a sibling directory.

**Diff.** New shared module `src/shared/markdown/diffBlocks.ts`: runs `parseBlocks` on both sources with the current rules, matches blocks by `text` using an LCS, then pairs each unmatched run of baseline blocks with the unmatched run of current blocks at the same position as `modified` and the surplus as `added`. Baseline blocks left with no partner become `removed` markers positioned before a current block index. Whitespace-only source changes give equal canonical text, so they show nothing. Because both sides are reparsed at diff time, an `anchoringVersion` bump never produces false changes, and the diff needs no re-anchoring: it does not use the anchorer, so approximate matches (#52) are irrelevant to it.

**API.** `GET /api/documents/<path>/changes` returns `{ sourceHash, baselineAt, changes: [{ blockIndex, kind }], removed: [{ beforeBlockIndex }] }` or an empty list when there is no baseline. `POST .../changes/dismiss` rewrites the baseline to the current source. The response carries the `sourceHash` of the source it diffed; the browser discards a response whose hash differs from the source it rendered, which is also how it avoids marking a stale render (#65). Re-fetch on `onDocumentChanged`, alongside `documentSource.refresh()`.

**Protocol.** Bump `protocolVersion` to 3. An older server would ignore `baselines/` and not refresh it on submit, so a newer server taking over would diff against a stale round. Bumping makes the CLI replace an older server, and a newer server is refused by an older CLI as today. No CLI command changes. The web app is served by the same server, so browser and API versions cannot disagree.

**UI** (`DocumentView`, `DocumentControls`, `BlockGutter`):
- Changed blocks get a coloured bar in the gutter and a faint background via a class on the block, not a new measured overlay. Added and modified use different tints and a text label for accessibility. A removed block shows a small "removed here" tick between blocks; deleted text is not shown.
- `DocumentControls` gets a "N changes since your last submit" chip with previous and next buttons (and keyboard shortcuts) that scroll to the next changed block, grouping adjacent changed blocks as one change. A "Mark as seen" button calls dismiss and clears marks in every tab.
- Marks sit left of the thread markers and bars, which use their own layer. The design reuses the block boxes `DocumentView` already measures and adds no per-block measurement, so it should not worsen #66; I have not profiled that.

## Risks

- Heavy rewrites mark most of the doc. Tell early: a "N changes" over about half the blocks in testing; fall back to a "large rewrite" note.
- Blocks are matched by text, so a moved paragraph shows as removed plus added. Acceptable for this goal.
- A user edit between submit and the agent's edit is shown too. The label says "since your last submit", not "by the agent".
- Baselines for deleted docs linger. Prune when a doc is gone, as a follow-up.
- Diff cost on very large docs: LCS is quadratic in blocks. Check with a doc of a few thousand blocks.

## Done when

- Submit Revise on a doc, have the agent edit two passages, and the doc shows exactly those blocks marked and "2 changes" stepping between them.
- A doc never submitted shows no control; a whitespace-only edit shows none.
- Mark as seen clears the marks in a second tab; a new Revise submit replaces the baseline.
- Bumping `anchoringVersion` alone changes nothing in the marks.
- `diffBlocks` has unit tests for add, remove, modify, move and reorder; a Playwright test covers the stepping flow; `pnpm verify` and `pnpm test:e2e` pass.
- Starting an older-protocol server in the integration tests is replaced by the new CLI.
- Possible follow-up, out of scope: a side-by-side or raw diff view.
