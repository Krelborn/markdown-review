# Block ranges and structures: design spec

- **Date:** 2026-10-13
- **Status:** Approved in spec review (2026-10-13)
- **Changes:** sections 5 (Comment highlights), 6 (The + target) and 10 (Overlapping threads) of the [document rendering spec](2026-10-09-document-rendering-design.md), and the gutter's width, which the [wide blocks spec](2026-10-10-wide-blocks-design.md) counts in the view's width
- **Changes nothing in:** the store, the HTTP API, the CLI or the protocol. The canonical text does not change, so neither `anchoringVersion` nor `protocolVersion` changes.

## 1. Problem

The gutter left of the doc picks one block: a paragraph, a heading, a table row, a code block, an HTML block or the frontmatter. Each list item adds its own paragraphs. A table, a list, a quote and the section under a heading are not blocks, so nothing picks them.

1. **There is no way to comment on a whole table or list with one action.** The **+** beside a table quotes one row. The comment cards spec left "Commenting on a whole table" out of scope for this reason.
2. **There is no way to comment on several blocks from the gutter.** The user can drag a text selection across paragraphs, and **Comment** anchors it, but the gutter offers nothing between one block and none. Selecting text across table rows is awkward, and the selection has to start and end exactly on the blocks' text.
3. **There is no way to comment on a section.** "This whole section needs rethinking" has to go on its heading, or on a selection dragged from the heading to the section's last character.
4. **A comment on many blocks would swamp the doc.** Highlights tint and underline every character of a passage. A comment on a section would tint the whole section, make every comment inside it look like an overlap, and make a click anywhere in its text select it.

The anchor model already supports all of this. A comment on a block is a passage from the block's first character to its last (`blockPassage`), and a passage may run across any number of blocks: the server works out its lines and re-anchors it, and the CLI prints it.

## 2. Assumptions

1. **Only desktop browsers reach the app.** The server listens on `127.0.0.1`. Pointer events cover pen and touch, but this design is for a mouse or trackpad. A touch drag in the gutter scrolls the page, which cancels it.
2. **Chromium and WebKit are the browsers that matter**, as the end-to-end tests run in them.
3. **StylesUI stays at 0.7.** Everything here is drawn in `DocumentView.module.css` with StylesUI's tokens.
4. **The agent needs nothing new.** A comment on a span of blocks reaches it as a passage with its lines and a quote, which `formatInbox` shortens to its first 120 and last 60 characters. The agent reads the lines from the file.
5. **One spec.** Every change is in how the doc view picks and shows blocks. The plan slices it into the steps in section 10.

## 3. Objective and success criteria

**Objective:** a reviewer can comment on any run of blocks, and on a whole table, list, quote or section with one click, without changing what a click on the gutter does today, and such a comment sits beside the text it is about rather than over it.

**Success looks like:**

1. **Drag.** Pressing in the block lane, on the **+** or beside it, and dragging up or down to another block starts a comment on every block from the first to the last, in either direction. Its passage runs from the first block's first character to the last block's last character. While the user drags, the blocks are framed and the bar runs beside all of them.
2. **Click.** A click in the block lane, or on the **+**, starts a comment on the block level with it, as today. A drag released on the block it started on is a click.
3. **Cancel.** Escape during a drag ends it, and starts no comment.
4. **Scroll.** Dragging near the top or bottom of the doc column scrolls it, and the drag takes in the blocks that come under the pointer.
5. **Bracket.** With the pointer in the gutter, the bracket lane shows a bracket beside the innermost table, list, quote, alert or section around the block level with the pointer. Beside a heading, it is the heading's section.
6. **Structure.** With the pointer in the bracket lane, the structure is framed and labelled, such as "Comment on the table". A click starts a comment on all of it.
7. **⌥-click.** ⌥-click in the block lane or on the **+** does what a click in the bracket lane does. While ⌥ is held with the pointer in the gutter, the frame and label show the structure.
8. **Bars.** A comment whose passage covers two or more whole blocks has a bar beside those blocks. Its text is not painted, it deepens no other highlight, and pointing at or clicking its text does nothing. Its marker is where it would be today.
9. **Frames.** Pointing at the bar, the marker or the card of such a comment frames its blocks in the hovered colour. Selecting it turns the bar and the frame to the selected colour.
10. **Writing.** While the user writes a comment on two or more whole blocks, the blocks stay framed.
11. **Nothing else moves.** A comment on one block, or on part of one, looks and behaves as today. The conformance test passes unchanged, `anchoringVersion` and `protocolVersion` are unchanged, and `pnpm verify`, `pnpm build`, `pnpm test:e2e` and `fallow audit` pass.

## 4. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Picking a run of blocks | Drag in the gutter | Shift-click to extend the open comment; text selection only, as now | Chosen by the user. Picks rows of a table, items of a list or paragraphs in one gesture, and a click stays a click |
| Picking a whole structure | A bracket lane outside the block lane | A menu on the **+**; a second click on the **+** to grow the comment; handles on each table and heading | Chosen by the user. One click, with a preview first, and the block lane keeps today's behaviour. A menu takes two clicks, a second click changes what a click means, and a handle by a table's first row competes with that row's **+** |
| Shortcut | ⌥-click in the block lane or on the **+** | None | Chosen by the user, on top of the bracket lane. Picks a structure without moving to the lane |
| Which structure the bracket offers | The innermost around the block level with the pointer; a heading's own section | One lane per level, outermost on the left | One lane fits in the gutter. Outer levels are reached by pointing beside them: beside an outer list item for the outer list, beside a heading for its section |
| What counts as a structure | Tables, lists, quotes, alerts, and the sections of top-level headings, when they cover two or more blocks | List items too | A structure of one block is that block. A list item with nested items can be picked by dragging |
| Where structures are found | markdown-it's tokens, in `src/shared/markdown` | The rendered page's elements | The tokens nest exactly, the code is tested in the `node` project, and the server can name what a comment covers later |
| The anchor | A passage from the first block's start to the last block's end | A new anchor kind that records the structure | No change to the store, the API, the CLI or the protocol. The agent gets the lines and the quote |
| Gutter width | 4.5rem: a 1rem bracket lane outside the block lane, and 0.5rem more between the **+** and the prose for the comment bars | 3rem, as now | The user agreed the gutter can widen. Every point that picks a block today still picks it |
| Showing a comment on a span | A bar beside its blocks, and a frame round them when it is hovered or selected | A tint on the text, as now; a fainter tint of its own; a frame all the time | Chosen by the user. The text stays readable, comments inside it keep their own look, and a click on its text is a click on text |
| Which comments get a bar | Those whose passage covers two or more whole blocks, worked out from the anchor each time the doc renders | Also comments on one block; a flag stored with the thread | A tint reads well on one block. Working it out keeps the store as it is. A re-anchored passage that no longer starts and ends on block edges is tinted, which still shows it truly |
| Pointing at a bar | Hovers its comment, and a click selects it | A bar that only shows | A bar is where the comment is, as a highlight is. A bar's target is 6px wide, so a click there no longer picks a block: the rest of the block lane still does |
| Bar lanes | Two, the shorter passage nearest the prose; any more share the outer lane | As many lanes as overlapping comments | The gutter's room. Three comments on overlapping spans are rare |
| Writing a comment on a span | A frame, and no pending tint | The pending tint, as for a passage | Matches how the comment shows once saved. A comment on one block keeps both, as now |

## 5. Layout

The gutter, from the view's left edge to the prose:

```text
|<- bracket lane ->|<--------------- block lane ---------------->|
|      1rem        |                   3.5rem                    |
|                  |                                             |
|   [              |        ( + )                      ║   ║     |  ## Goals
|   [              |          ┆                        ║   ║     |  The loop should feel instant…
|   [              |          ┆                        ║         |  - Open a doc in under a second
    ^ bracket                 ^ the + and the pick bar,  ^   ^ comment bars: lane 2, 1rem from
                                2.125rem from the prose          the prose, and lane 1, 0.625rem
```

- **Sizes.** `--gutter-size` grows from 3rem to 4.5rem. The view's padding and `--max-view-size` follow it, so the prose keeps its 72ch and moves right by 1.5rem. `--wide-room` shrinks by 0.75rem either side as the view widens.
- **The block lane** is the old gutter, 0.5rem wider on its inner side. The **+** moves 0.5rem left, so its right edge is 1.25rem from the prose, clear of the bars. `--gutter-lane`, the middle of the **+**, becomes `calc(var(--gutter-size) - 1.25rem - var(--block-button-size) / 2)`.
- **The bracket lane** is new, and outside the block lane. The bracket is a 2px line in the lane's middle, from 4px above the structure to 4px below, with 5px ends turned towards the prose. It is `--sui-color-text-muted` at 45% opacity beside the block lane, and `--sui-color-primary` while the bracket lane picks it.
- **Comment bars** are 3px wide with round ends, centred 0.625rem (lane 1) and 1rem (lane 2) from the prose, from 6px above the first block to 6px below the last, as the frame is. They are `--sui-color-warning` at rest, 4px wide while hovered, and `--sui-color-primary` while selected.
- **The structure's label** sits on the frame's top edge at its right end: `--sui-font-size-xs` text in `--sui-color-on-primary` on `--sui-color-primary`, with `--sui-radius-full` corners. It reads "Comment on the table", "Comment on the list", "Comment on the quote", "Comment on the note" (or tip, important, warning, caution), or "Comment on the section “Goals”". During a drag over more than one block it reads "3 blocks".
- **The frame round a span** reaches from 4px left of the prose to 4px right of the prose or of the widest block, whichever is further, and from 6px above the first block to 6px below the last. When every block is a row of one table, it is the table's shown box instead. A frame round one block is as today.
- **Order, back to front:** the gutter, the bars, the frames, the **+**, the markers.

## 6. Behaviour

### Structures

`findStructures` reads them from the token stream `parseBlocks` uses, and `createDocumentText` adds them to `DocumentText` as `structures`.

- **Kinds.** A table runs from `table_open` to `table_close`. A list runs from `bullet_list_open` or `ordered_list_open` to its close. A quote runs from `blockquote_open` to its close. An alert runs from the alert plugin's open token to its close, and is named by its kind. A structure holds the blocks whose tokens lie between its open and close tokens.
- **Sections.** Only headings outside every container start a section. A section runs from its heading's block to the block before the next such heading of the same or a higher rank, or to the doc's last block. Its name is the heading's canonical text. Frontmatter is in no section.
- **Size.** A structure of fewer than two blocks is dropped, such as a one-item list or a heading with nothing under it.
- **Innermost.** For a block that is a section's heading, its section. For any other block, the structure around it with the fewest blocks, and of two with the same blocks, the one nested deeper.

### The bracket lane

- With the pointer anywhere in the gutter, the block lane picks the block level with the pointer as today, and the bracket lane shows the bracket of that block's innermost structure. With the pointer in the bracket lane, the block lane's track, bar and frame give way to the structure's frame and label, and the **+** stays beside the block without its picking background.
- A click in the bracket lane starts a comment on the bracketed structure.
- The lane is hidden from assistive technology, as the gutter is.

### Dragging

- A drag starts when the primary button goes down in the block lane, on the **+** included, without ⌥. The gutter captures the pointer and stops the press selecting text.
- While the button is held, the span runs from the block the drag started on to the block level with the pointer, in either direction. Moving past the halfway line between two blocks moves the end of the span, as `blockLevelWith` picks blocks today. The **+** stays beside the first block, the pick bar and the frame cover the span, and over more than one block the label shows the count.
- Releasing starts a comment on the span, with the hash of the rendering it was made on. On one block that is today's comment on the block.
- Escape, a lost capture or the doc rendering again ends the drag, and starts nothing.
- With the pointer within 3rem of the top or bottom of the doc column's visible box, the column scrolls, faster nearer the edge. The span follows the blocks that come under the pointer.
- If the comment editor holds unsaved text, starting a comment asks about it first, as the **+** does today.

### ⌥-click

- ⌥-click in the block lane or on the **+** starts a comment on the innermost structure of the block level with it.
- While ⌥ is held with the pointer in the block lane, the frame, the label and the bracket show that structure, as the bracket lane does.
- A drag ignores ⌥ after it starts.

### Comments on a span

- **Which.** A highlighted thread is on a span when its passage starts at one block's start and ends at a later block's end. `wholeBlockSpan` works this out from the offsets.
- **Text.** `useThreadHighlights` paints no tint for such threads and leaves them out of the overlaps. It still finds their ranges, to place their markers and to scroll to them. `useHoveredThread` and `useDocumentClicks` leave them out, so their text is plain text to the pointer.
- **Bars.** One per such thread, in lane 1 unless its blocks overlap those of a thread already in lane 1, then lane 2. Threads go in order of their passages' length, shortest first. Pointing at a bar reports its thread as hovered, as a marker does, and a click selects it. The bars are hidden from assistive technology: the marker is the control for keyboards and screen readers.
- **Hovered.** While the thread is hovered, from its bar, its marker or its card, its bar widens and a frame in `--sui-color-warning`, with a 7% fill, surrounds its blocks.
- **Selected.** While the thread is selected, its bar and its frame are `--sui-color-primary`, as the frame of a comment being written is.
- **Picking over a bar.** With the pointer on a bar, the gutter picks no block, as with the pointer on **Comment** beside a selection.

### Writing a comment on a span

While the editor's new comment is a passage on two or more whole blocks, `usePendingSpan` keeps a frame round the blocks, measured again whenever the layout changes, and the pending tint is not painted. A comment on one whole block keeps its frame and its pending tint, as now.

## 7. Components and files

| File | Change |
| --- | --- |
| `src/shared/markdown/DocumentStructure.ts` (new) | A structure's kind, first and last block, nesting depth and name |
| `src/shared/markdown/findStructures.ts` (new) | The doc's structures, from the tokens and the leaf blocks |
| `src/shared/markdown/DocumentText.ts`, `createDocumentText.ts` | `structures`, found from the same parse as the blocks |
| `src/web/anchoring/blockPassage.ts` | Takes a first and a last block |
| `src/web/anchoring/wholeBlockSpan.ts` (new, replaces `wholeBlockIndex.ts`) | The first and last block of a passage that covers whole blocks, or null |
| `src/web/anchoring/innermostStructure.ts` (new) | The structure a bracket offers beside a block |
| `DocumentView/measureSpan.ts` (new) | The box of a span of blocks, from `measureBlock` |
| `DocumentView/BlockGutter.tsx` | The bracket lane and the block lane; the drag and ⌥-click |
| `DocumentView/useGutterDrag.ts` (new) | The drag's span, its capture, Escape, scrolling the column, and ending it when the doc renders again |
| `DocumentView/StructureBracket.tsx` (new) | The bracket and, while picked, the label |
| `DocumentView/useHoveredBlock.ts` | Which lane the pointer is in, whether ⌥ is held, and no pick while the pointer is on a bar |
| `DocumentView/BlockTarget.tsx` | Frames a span, in the primary or the warning colour |
| `DocumentView/usePendingBlock.ts` → `usePendingSpan.ts` | Frames the span a comment is being written on |
| `DocumentView/ThreadBars.tsx` (new), `placeThreadBars.ts` (new) | The bars of comments on spans, their lanes, and their hover and click |
| `DocumentView/useThreadHighlights.ts` | No tint or overlap for comments on spans, or for a pending comment on one |
| `DocumentView/DocumentView.tsx`, `useDocumentOverlay.ts` | Splits the highlighted threads into those on spans and the rest |
| `DocumentView/DocumentControls.tsx` | Starts comments on spans and structures; draws the bars and frames |
| `DocumentView/DocumentView.module.css` | The gutter's sizes and lanes, the bracket, the label and the bars |
| `README.md` | Section 9 |

## 8. Testing

### Unit tests (`node` project)

- **`findStructures.test.ts`:** a table, a bullet list and an ordered list, a nested list, a quote holding a list, each kind of alert, sections of `#` to `###` with their ends, a setext heading, a heading inside a list or a quote that starts no section, frontmatter before the first heading, and a one-item list and an empty section dropped.
- **`createDocumentText.test.ts`:** the empty doc has no structures.

### Unit and component tests (`web` project, jsdom)

- **`wholeBlockSpan.test.ts`:** one block, several blocks, part of a block, and a passage that starts on a block's edge and ends inside another.
- **`innermostStructure.test.ts`:** a heading, a paragraph under it, a row, an item of a nested list, and two structures over the same blocks.
- **`placeThreadBars.test.ts`:** apart, overlapping, nested, and three overlapping.
- **`measureSpan.test.ts`:** rows of one table, blocks either side of a wide block, and one block.
- **`DocumentView.test.tsx`:**
  - "must start a comment on every block from the first to the last when the user drags down the gutter", and up it.
  - "must start a comment on one block when the user releases a drag on the block it started on"
  - "must start no comment when the user presses Escape during a drag"
  - "must start a comment on the whole table when the user clicks the bracket lane beside a row", and the list, the nested list, the section beside its heading, and the section beside a paragraph under its heading.
  - "must start a comment on the whole table when the user ⌥-clicks the gutter beside a row", and ⌥-clicks the **+**.
  - "must frame the structure and name it when the pointer is in the bracket lane"
  - "must not paint a comment on several whole blocks", "must not deepen another comment's highlight inside a comment on several whole blocks" and "must not select a comment on several whole blocks when the user clicks its text"
  - "must select a comment on several whole blocks when the user clicks its bar", and "must report it as hovered when the pointer is on its bar"
  - "must keep the blocks framed when the user writes a comment on several whole blocks"
  - The existing gutter tests keep passing unchanged, apart from where they put the pointer.

### Conformance

`pnpm vitest run --project web src/web/rendering/blockConformance.test.ts` passes unchanged.

### End-to-end tests (Playwright, Chromium and WebKit)

jsdom lays nothing out, so positions, drags and scrolling are checked here.

- **`comments.e2e.ts`:**
  - "must start a comment quoting the rows the user drags over in the gutter"
  - "must scroll the doc column when the user drags to its bottom edge"
  - "must start a comment quoting the whole table when the user clicks the bracket beside it", and when they ⌥-click the gutter beside a row.
  - "must show a bar, and no highlight, beside a saved comment on a section", and "must frame the section when the user points at the comment's card"
  - `gutterBeside` picks a point near the block lane's left edge, as the bracket lane now holds the gutter's left edge.
- **`layout.e2e.ts`:** the **+**'s right edge is 1.25rem from the prose, and the prose starts 4.5rem into the view.

### By hand

In light and dark mode, and in every palette: drag over rows, items and paragraphs; point along the bracket lane down a doc with a nested list, a table and three heading levels; ⌥-click; save comments on two overlapping sections and a table inside one, then hover and select each.

## 9. Docs to update

The README's "Comment on a block" line becomes:

- **Comment on blocks:** hover over a block and click the **+** in the left margin, or drag down the margin to take in several blocks. Use this for code blocks, diagrams and HTML.
- **Comment on a table, list or section:** click the bracket at the far left of the margin, or ⌥-click the margin.

## 10. Delivery

One pull request, in commits that each pass `pnpm verify`:

1. Spans: `blockPassage` over a first and last block, `wholeBlockSpan`, `measureSpan` and `usePendingSpan`.
2. The wider gutter, the **+**'s new place, and the drag.
3. `findStructures`, `innermostStructure`, and the bracket lane.
4. ⌥-click.
5. Comments on spans: no tint, the bars and their frames.
6. README.

## 11. Commands

```sh
GITHUB_TOKEN=$(gh auth token) pnpm install                                    # first, in a new worktree
pnpm vitest run --project node src/shared/markdown                            # findStructures
pnpm vitest run --project web src/web/anchoring src/web/components/DocumentView
pnpm vitest run --project web src/web/rendering/blockConformance.test.ts      # canonical text unchanged
pnpm test:e2e src/e2e/comments.e2e.ts src/e2e/layout.e2e.ts                   # Chromium and WebKit
pnpm verify                                                                   # lint, format check, typecheck and tests
pnpm build && pnpm test:e2e                                                   # what CI runs besides
pnpm exec fallow audit                                                        # what the pre-commit hook runs
```

## 12. Boundaries

- **Always:** keep every change inside `src/web`, `src/shared/markdown` and the README; run the conformance test; check light and dark mode.
- **Ask first:** changing the store, the HTTP API or the CLI, such as naming the structure a comment covers in the inbox; changing StylesUI.
- **Never:** change `anchoringVersion` or `protocolVersion` for this; change what a click in the block lane or on the **+** does; edit older specs, which record the design as it was.

## 13. Out of scope

- **Shift-click to extend.** Growing the open comment to the block the user shift-clicks, keeping its text.
- **Structures from the keyboard.** The **+** is the keyboard's control, and offers one block. A menu on it, "this row · the table · the section “Goals”", would reach structures without a pointer.
- **Naming what a comment covers.** "Table" or "Section “Goals”" beside a card's lines, and in the agent's inbox.
- **Re-anchoring by structure.** A comment on a section the agent rewrites by more than a fifth goes outdated, as any passage does.
- **⌥-drag to snap a span to structures.**
- **Touch.**

## 14. Open questions

None.
