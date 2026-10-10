# Wide blocks: design spec

- **Date:** 2026-10-10
- **Status:** Draft, for review
- **Changes:** the doc column's layout, from the [side panel redesign](2026-10-09-side-panel-redesign-design.md) ("Prose width") and the [document rendering spec](2026-10-09-document-rendering-design.md) (code blocks, tables and Mermaid)

## 1. Problem

On a large screen the doc feels narrow and dense. Measured in Chromium at 1920×1080 with this repo's own specs:

1. **The prose is not narrow in characters.** It is 726px wide and holds 93 to 95 characters a line, at every window width from 1280px up. `72ch` is measured on the "0", about 10px in the macOS system font, which is wider than the average letter. Widening the prose to `90ch` would give 117 to 120 characters a line, past what reads comfortably.
2. **Tables are held to the prose's width.** The four-column Decisions table of the side panel spec is 1148px tall, with cells of up to 7 lines. The design spec's tables are 6703px tall in all, and 26 of their 248 cells run to more than 3 lines.
3. **Code wraps.** Prose styles code with `white-space: pre-wrap`, so a line longer than about 82 characters wraps. The design spec has 11 wrapped lines, and its architecture diagram, drawn in box-drawing characters, falls apart.
4. **Mermaid shrinks wide diagrams to fit the prose,** so their labels get smaller than the text around them.
5. **The space beside the prose is empty.** At 1920px there are 345px either side of it, and at 2560px 665px.

A prototype that let tables and code reach up to `28ch` past the prose's right edge made the design spec's tables 19% shorter (5455px), left 10 cells longer than 3 lines, and wrapped 1 line of code. The prose did not change.

## 2. Intent and success criteria

**Intent:** dense docs read more easily on large screens. Prose keeps its reading width. Tables, code and diagrams that need more room use the empty space to the prose's right.

**Success looks like:**

1. The prose is as wide as it is today, at every window width.
2. A table, code block or Mermaid diagram wider than the prose starts at the prose's left edge and reaches right, up to `28ch` past the prose or to the edge of the space beside it, whichever is less. One that fits the prose looks as it does today.
3. A code line never wraps. A code block too wide even for its extra room scrolls sideways, as a wide table does, and the keyboard can scroll it.
4. The doc column never scrolls sideways, at any window width.
5. A thread's marker sits just right of the table or code block its passage is in, clear of the block. Every other marker sits where it does today.
6. The Comment button for a selection in the part of a wide block past the prose sits beside the end of the selection, and stays inside the doc column.
7. Prose has a line height of 1.6. Code keeps 1.5. The **+** still lines up with each block's first line.
8. The canonical text does not change: the conformance test passes, and neither `anchoringVersion` nor `protocolVersion` changes.

## 3. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Prose width | Keep `72ch` | `90ch`; a wider width on large screens | Chosen by the user. Lines are already 93 to 95 characters long, and `90ch` makes them 120 |
| What grows | Tables, code blocks and Mermaid diagrams | Images and blockquotes too | Chosen by the user. These are the blocks whose content has a width of its own. An image sits inside a paragraph, so it could not grow without the paragraph |
| Direction | Right only, from the prose's left edge | Centred on the prose | Chosen by the user. The **+** and the gutter's track stay where they are, every block shares the prose's left edge, and the extra width goes towards the comments |
| How far | Up to `28ch` past the prose, so about `100ch` in all, within the view's margin | All the room up to the markers' lane | Chosen by the user. At 2560px a table could otherwise be 1600px wide, too wide for the eye to follow a row |
| Code that is still too wide | Scrolls sideways, never wraps | Wrap, as now | Chosen by the user. Wrapping breaks diagrams drawn in text and the indentation that shows a program's structure |
| Code in the tab order | Every code block, as every table already is | Only the blocks that overflow | Matches tables, and needs no measuring when the window resizes. Blocks that overflow could be singled out later if the extra tab stops get in the way |
| Line height | 1.6 for prose, 1.5 for code | 1.5 throughout; larger type on large screens | Chosen by the user. Longer lines need more space between them. Larger type kept the same characters a line but made the docs 14% longer |
| Where the room comes from | A container query on the doc's own outer element | Measuring the column in JavaScript; a container on the App's doc column | CSS keeps up with resizes without a hook, and the container stays inside `DocumentView` |
| Diagram width | `renderMermaidDiagrams` copies the drawing's natural width to its block | Mermaid's `useMaxWidth: false` | Mermaid already writes the natural width as the drawing's `max-width`. Changing Mermaid's configuration would change every diagram's sizing, not just their widths |

## 4. Layout

### Wide window (1920px, comments panel open)

```text
+----------------------------------------------------------------------+------------------+
| [icon] plan.md v                                                 (i) |                  |
+----------------------------------------------------------------------+------------------+
|                 + | Prose, at 72ch ......................... |  ①     | Comments         |
|                   |                                          |        |                  |
|                 + | +-----------------------------------------------+ ② |              |
|                   | | Table, code or diagram, up to 28ch more        |    |              |
|                   | +-----------------------------------------------+    |              |
|                 + | Prose ................................... |        |                  |
|      <- margin -> |<---------------- 72ch ------------------>|<- margin ->|              |
+----------------------------------------------------------------------+------------------+
```

① A marker for a thread in the prose, where it is today. ② A marker for a thread in the wide block, just right of the block.

The view stays centred in the doc column at its current width, `72ch + var(--gutter-size) + 2.5rem`. A wide block reaches into the view's right margin. That margin is the most it can use, so it never reaches the column's edge. Its marker sits in the same 2.5rem lane past the block's right edge.

### Narrower windows

| Window | Room past the prose | What changes |
| --- | --- | --- |
| 2560px | `28ch`, about 282px | A block can be about 1008px wide |
| 1920px | `28ch`, about 282px | The same |
| 1440px | about 105px | A block can be about 831px wide |
| 1280px | about 25px | Nearly none: wide tables scroll as they do today, and long code scrolls |
| Below about 1200px, and the narrow layout | 0 | Only the line height, and code scrolling instead of wrapping |

### CSS

In `DocumentView.module.css`:

```css
/* Registered so that it computes to a length in the view, which useSelectionComment reads */
@property --wide-room {
  syntax: "<length>";
  inherits: true;
  initial-value: 0px;
}

/* The doc's outer element is a size container, so the view can tell how much room there is beside it */
.frame {
  container-type: inline-size;
}

.view {
  /* How far a table, code block or diagram may reach past the prose: the view's margin, but no more than 28ch */
  --wide-room: clamp(0px, (100cqi - (72ch + var(--gutter-size) + 2.5rem)) / 2, 28ch);
}

.content {
  line-height: 1.6;
}

/* Prose already gives tables `inline-size: max-content` and lets them scroll */
.content table {
  max-inline-size: calc(100% + var(--wide-room));
}

.content div[data-md-block]:has(> pre) {
  inline-size: max-content;
  max-inline-size: calc(100% + var(--wide-room));
  min-inline-size: 100%;
}

.content div[data-md-block] > pre {
  line-height: var(--sui-line-height-normal);
  overflow-x: auto;
  white-space: pre;
}

/* --diagram-width is the drawing's natural width; a narrower drawing stays centred in the prose */
.content div[data-mermaid-definition] {
  inline-size: clamp(100%, var(--diagram-width, 100%), 100% + var(--wide-room));
}
```

A prototype checked the room, table and code rules in Chromium and WebKit at 1280, 1440, 1920 and 2560px, with the App's doc column as the container, which is as wide as `.frame`. Short code stayed as wide as the prose, long code reached the limit and scrolled, and the doc column never scrolled sideways. It also showed that a Mermaid drawing, which Mermaid gives `width="100%"`, does not widen a `max-content` block, which is why diagrams need `--diagram-width`; that rule was not prototyped.

Nested blocks, such as code in a list item, start at their own left edge and reach the same right edge, because the list item ends where the prose does.

## 5. Components

### DocumentView

- The outer `Stack` takes `className={styles.frame}`, which makes it the size container.
- The view's comment says the prose keeps a reading width, and that tables, code and diagrams can reach into its right margin.

### Markers (`useThreadHighlights.ts`, `ThreadMarkers.tsx`)

- `ThreadMarker` gains `outset`: how far the table, or else the block, that the thread's passage starts in reaches past the prose's right edge, or 0. The table comes first because a row of a scrolled table is wider than what the table shows, which is why `measureBlock` clamps to the table too.
- `placeMarkers` measures it from the start of each range: `startContainer`'s element, then `closest("table") ?? closest("[data-md-block]")`, then that element's right edge less the content's.
- `ThreadMarkers` places a marker at `insetInlineEnd: calc(${column * 2}rem - ${outset}px)`. Markers on the same line are in the same block, so they share an outset and their columns still step left.

### Selection Comment button (`useSelectionComment.ts`)

- `roomToRight` measures to the view's right edge plus `--wide-room`, read from the view's computed style, instead of to the view's right edge. A selection that ends in the part of a wide block past the prose gets its button beside it, and the button still stays inside the doc column, because the room is never more than the view's margin.
- Its doc comment changes to match.

### Block measuring (`measureBlock.ts`)

- `lineHeight` becomes 25.6, the doc's 16px text at the new line height of 1.6. Its comment says so.

### Rendering

- `makeTablesFocusable` becomes `makeScrollableBlocksFocusable`. It gives `tabindex="0"` to every `table` and to every `pre` that is the child of a block wrapper, and its doc comment says why: either can be wider than its box. `renderDocument` calls it and its doc comment lists code blocks in the tab order.
- `renderMermaidDiagrams` sets `--diagram-width` on each diagram's block wrapper to the drawing's `style.maxWidth`, where Mermaid writes its natural width, when it draws the diagram and again when it redraws it. A drawing with no `max-width` leaves the property unset, so its block stays as wide as the prose.

## 6. Unchanged

- The canonical text, `createMarkdownIt`, the markdown plugins, Shiki and DOMPurify. `tabindex` is an attribute, and the walk of a block's text reads its text, not its layout.
- `anchoringVersion` and `protocolVersion`.
- The **+**, the gutter and its track. Every block still starts at the prose's left edge.
- The frame round a block, which follows the block's box (or a row's table box) through `measureBlock` already.
- Hovering. A wide block is inside the view in the DOM, so the pointer over the part past the prose still reaches the view's listeners. That part counts as beside the content, so the **+** picks the block level with the pointer, as it does for a marker.
- The comments panel, the top bar and the narrow layout's drawer.

## 7. Conventions

The `coding-standards` plugin's TypeScript, React, comments and Vitest standards apply, and win over any code in this spec. Follow the code around each change:

- CSS stays in `DocumentView.module.css`, with properties in alphabetical order, as the rest of the file has them.
- A comment says why, not what, in a sentence with no full stop at the end, as the comments in `DocumentView.module.css` do.
- Tests are named `must … when …`.
- Every new export is used by code or tests in the same commit, or `fallow audit` fails the commit.

## 8. Testing

### Unit and component tests (`web` project, jsdom)

- `measureBlock.test.ts`: the tests that put the middle of a first line half a line down use the new line height.
- `renderDocument.test.ts`: "must put each table and code block in the tab order when the doc has tables and code" replaces the test for tables alone.
- `renderMermaidDiagrams.test.ts`: "must give a diagram's block the drawing's natural width when it draws the diagram".
- `DocumentView.test.tsx`: the marker tests still pass. jsdom lays nothing out, so where markers sit is checked end to end.

### Conformance

- `pnpm vitest run --project web src/web/rendering/blockConformance.test.ts` passes unchanged.

### End-to-end tests (Playwright, Chromium and WebKit, `layout.e2e.ts`)

A new window size, `largeWindow = { height: 1080, width: 1920 }`, and a doc with prose, a table with long cells, a code block with a 150-character line, a short code block, a wide Mermaid diagram and a narrow one.

- "must start each table at the prose's left edge, and let only a wide one reach 28ch past it, when the window is large": the table that fits stays as wide as its content.
- "must keep a short code block as wide as the prose and scroll a long one sideways without wrapping when the window is large": a long line's text is on one line, and the block's `scrollWidth` exceeds its `clientWidth`.
- "must draw a wide diagram past the prose and keep a narrow one centred in it when the window is large"
- "must never scroll the doc column sideways" at the wide, narrow and large window sizes.
- "must put a thread's marker just right of the wide table its passage is in": the marker's left edge is at or past the table's right edge, and inside the doc column.
- "must keep a marker for a thread in the prose beside the prose when the doc also has a wide table"
- "must show Comment beside a selection that ends past the prose in a wide table"
- "must let the keyboard reach a code block that is too wide for its room, so it can scroll it": Tab from the code block before it focuses it. The test stops at focus, because Playwright's WebKit does not scroll a focused table or code block with the arrow keys, while Chromium does.

The existing tests still pass, notably:

- "must lay a short doc out at the same reading width as a long one"
- "must frame a table row inside its table when the table is wider than the doc column"
- "must line the + up with a heading's line and keep it clear of the heading's frame"
- "must keep Comment in full view inside the doc column when the selected text reaches the column's right edge"

## 9. Commands

```sh
GITHUB_TOKEN=$(gh auth token) pnpm install                                    # first, in a new worktree
pnpm vitest run --project web src/web/rendering/blockConformance.test.ts      # canonical text unchanged
pnpm verify                                                                   # lint, format check, typecheck and tests
pnpm build                                                                    # dist/cli.js and dist/web
pnpm test:e2e                                                                 # Chromium and WebKit
pnpm exec fallow audit                                                        # what the pre-commit hook runs
```

To look by hand: `pnpm build`, then in a git repo with a dense doc, `MARKDOWN_REVIEW_NO_BROWSER=1 node <this repo>/dist/cli.js open <doc.md>`, and open the URL at 1280, 1440, 1920 and 2560px wide, in light and dark mode.

## 10. Boundaries

- **Always:** keep the prose at `72ch`; run the conformance test and the end-to-end tests in both browsers before committing; keep each change inside `DocumentView` and `src/web/rendering`.
- **Ask first:** changing Prose in StylesUI rather than overriding it here; changing the `28ch` limit, the comments panel's width or the breakpoints; adding a dependency; anything that would change the canonical text.
- **Never:** let the doc column scroll sideways; move the **+** or the gutter; change `anchoringVersion` or `protocolVersion` for this; edit older specs, which record the design as it was.

## 11. Docs to update

None. The README and AGENTS.md say nothing about the doc's width, and older specs stay as they are.

## 12. Out of scope

- A reading mode or a full-width toggle. Full-width prose would be about 200 characters a line at 1920px.
- Wider images, blockquotes, alerts or the Properties panel.
- Larger type on large screens.
- Taking the extra room from the left margin too, or moving the prose off centre.
- Making only the code blocks that overflow focusable.

## 13. Open questions

None blocking. Two to watch once it ships:

1. **Tab stops.** Every code block joining the tab order may make tabbing through a long doc slow. If so, give `tabindex` only to blocks that overflow, which needs them measured again when the window resizes.
2. **Line height in StylesUI.** If 1.6 suits other apps, it could become Prose's default upstream, and this override would go.
