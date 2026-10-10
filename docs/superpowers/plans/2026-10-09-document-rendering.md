# Document Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rendered doc read like a well-typeset document, and make the review layer on top of it unmistakable:
- code blocks with the prose gap, one frame and a language header
- stronger comment highlights, deeper where threads overlap
- a frame on the block the + will comment on
- highlights and cards that emphasise each other on hover
- heading links, task-list checkboxes that don't look disabled, and Mermaid diagrams that follow light and dark mode
- GitHub alerts as callouts
- frontmatter as an Obsidian-style Properties panel

**Architecture:**
- **CSS** in `DocumentView.module.css` styles the rendered doc. New markup the app adds is identified by `data-*` attributes, so it needs no `:global`. The alert plugin's classes are the exception.
- **Overlay hooks.** `useDocumentOverlay` gathers the hooks that draw over the doc (highlights, markers, the + target, the hovered thread, the selection's Comment button), which keeps `DocumentView` under fallow's complexity limit.
- **Hover state.** `HoveredThreadContext`, provided by `HoveredThreadProvider` around the two columns, shares the hovered thread between the doc and the comments.
- **Canonical text.** Frontmatter (a block rule of our own) and alerts (`@mdit/plugin-alert`) change the canonical text. A new `anchoringVersion`, folded into `hashSource`, re-anchors stored threads once.
- **Browser-only rendering.** The browser turns the frontmatter's fallback code block into a Properties panel with `yaml`, loaded only when a doc has frontmatter.

**Tech Stack:** markdown-it 15.0.2, `@mdit/plugin-tasklist` 1.1.3, `@mdit/plugin-alert` 2.0.2 (new), `yaml` 2.9.1 (new), Shiki 4.5, Mermaid 12.1, React 19.3 with the React Compiler, `@krelborn/stylesui` 0.2.1, CSS modules, `clsx`, Vitest 5 with jsdom and Testing Library, Playwright 1.64 (Chromium and WebKit), oxlint, oxfmt, fallow.

**Spec:** `docs/superpowers/specs/2026-10-09-document-rendering-design.md`. It changes sections 7 and 10 of `docs/superpowers/specs/2026-10-08-markdown-review-design.md`. Section 15 of the spec, table polish, is a StylesUI change and is not part of this plan.

## Global Constraints

- **Branch.** Work on a branch named `document-rendering`, created from `main` before Task 1: `git switch -c document-rendering`.
- **Coding standards.** The `coding-standards` plugin's TypeScript, React, comments and Vitest standards are authoritative over this plan's code. They require:
  - props sorted alphabetically in interfaces and JSX, then `aria-*`, then `data-*`
  - explicit boolean values
  - `clsx` for conditional classes, as `clsx(styles.a, { [styles.b ?? ""]: condition })`, the pattern `ThreadCard` uses
  - full words in identifiers
  - multi-line JSDoc, and no comment where the code already says it
  - imports grouped external, then `../`, then `./`, sorted by path, with type imports before value imports from the same module
  - tests named `must … when …`, with Arrange-Act-Assert separated by blank lines, a blank line between tests, and one `describe` per file
- **CSS.** Properties are in alphabetical order within each rule, as in the existing CSS modules. Colours, sizes and radii use StylesUI tokens.
- **Values copied from the spec:**

  | Item | Value |
  | --- | --- |
  | Threads highlight | `--sui-color-warning` at 30%, solid 2px underline in `--sui-color-warning-text` |
  | Overlap highlight | `--sui-color-warning` at 30%, no underline |
  | Hovered highlight | `--sui-color-warning` at 55%, solid 2px underline in `--sui-color-warning-text` |
  | Selected highlight | `--sui-color-primary` at 25%, solid 2px underline in `--sui-color-primary` |
  | Pending highlight | `--sui-color-primary` at 25%, dashed 2px underline in `--sui-color-primary` |
  | Underline offset | 3px, written as longhand `text-decoration-*` properties |
  | Paint order | threads, overlap, hovered, selected, pending (each paints over the ones before) |
  | Block target | 2px `--sui-color-primary` border, `--sui-color-primary` at 7%, `--sui-radius-lg`, 4px wider each side, 6px taller above and below, 120ms fade unless reduced motion |
  | Hovered card | background `--sui-color-secondary-subtle` |
  | Hovered marker | 2px `--sui-color-primary` outline |
  | Code frame | `--sui-color-surface`, `--sui-border-width` solid `--sui-color-border`, `--sui-radius-lg` |
  | Language header | monospace `0.75rem`, `--sui-color-text-muted`, surface mixed with 5% text |
  | Alert colours | note `info`, tip `success`, important `primary`, warning `warning`, caution `danger` |
  | Labels | "Properties", "No properties", "Empty", "Link to <heading text>", alert titles "Note", "Tip", "Important", "Warning", "Caution" |
  | Frontmatter fallback header | `frontmatter` |
  | Copied tick | 1.5 seconds |

- **Anchoring version.** Task 8 adds `anchoringVersion = 2`. Tasks 9 and 10 change the canonical text again on the same branch, before any release, so they keep it at 2.
- **Protocol.** `protocolVersion` stays 1, and the HTTP API, CLI and store file shapes don't change.
- **fallow audit** runs in the pre-commit hook.
  - Every new export must be used, by code or tests, in the same commit.
  - No function may exceed cyclomatic 20 or cognitive 15.
  - `DocumentView` is at cognitive 15, and fallow counts each hook and each `??` against it. Task 4 moves its overlay hooks into `useDocumentOverlay` before anything is added to it.
  - `App` is at 14, so the hover state lives in `HoveredThreadProvider`, not in a new hook in `App`.
- **Dependencies.** Install with `GITHUB_TOKEN=$(gh auth token) pnpm add <name>` (or `-D`), with no hand-written version, then run `pnpm format`, as `AGENTS.md` says.
- **Commands.**
  - One test file: `pnpm exec vitest run --project web <path>` or `--project node <path>`.
  - End-to-end tests: `pnpm test:e2e <path>`.
  - Before each commit: `pnpm lint && pnpm typecheck`.
  - Task 11 runs `pnpm verify` and the whole end-to-end suite.
- **Visual check.** Tasks that change how the doc looks end with this check:
  1. Run `pnpm build`.
  2. Set up a sample repository holding the conformance corpus:
     ```bash
     rm -rf /tmp/rendering-check && mkdir -p /tmp/rendering-check/docs && cd /tmp/rendering-check && git init -q
     cp <repo>/src/web/rendering/testing/conformanceCorpus.md docs/corpus.md
     MARKDOWN_REVIEW_NO_BROWSER=1 node <repo>/dist/cli.js open docs/corpus.md
     ```
  3. Open the printed URL in Chrome and in Safari, each in light and dark mode, and confirm what the task says.
  4. Stop the server with `node <repo>/dist/cli.js stop` from `/tmp/rendering-check`.
- **Commits** end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A doc that opens with a horizontal rule** (`---`, then a blank line) and has another `---` later must render as it does today, not as frontmatter. Task 10 adds a `parseBlocks` case, and the rule only accepts a non-blank second line.
2. **Frontmatter holding markup, invalid YAML, or YAML whose top level is a list** must show as text or as the code fallback, never as HTML. Task 10 adds `renderFrontMatter` cases for each.
3. **Frontmatter in a doc with Windows line endings** must still be recognised, with the right lines. Task 10 adds a `parseBlocks` case.
4. **A fence whose language holds quotes or angle brackets** must put the language in the attribute as text, and add no element. Task 3 adds a `renderDocument` case.
5. **A browser that refuses the clipboard copy** must still put the heading in the address, without an error. Task 6 adds a `DocumentView` case with `writeText` rejecting.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/web/components/DocumentView/DocumentView.module.css` | All styles of the rendered doc and its overlay | 1, 2, 3, 4, 5, 6, 9, 10 |
| `src/web/global.css` | Shiki's dark mode token colours | 1 |
| `src/e2e/layout.e2e.ts` | The block gap | 1 |
| `src/web/anchoring/findOverlaps.ts` (new) | Ranges where two ranges share text | 2 |
| `src/web/components/DocumentView/useLayoutRevision.ts` (new) | Counts content resizes, so measurements are taken again | 2 |
| `src/web/components/DocumentView/useThreadHighlights.ts` | Highlight layers and their paint order; markers | 2, 5 |
| `src/shared/markdown/createMarkdownIt.ts` | `data-language`; alerts; frontmatter rule and render rule | 3, 9, 10 |
| `src/web/components/DocumentView/BlockBox.ts` (new) | Where a block is, relative to the view | 4 |
| `src/web/components/DocumentView/measureBlock.ts` (new) | Measures a block's `BlockBox` | 4 |
| `src/web/anchoring/wholeBlockIndex.ts` (new) | The block whose whole text a passage covers | 4 |
| `src/web/components/DocumentView/usePendingBlock.ts` (new) | The block a whole-block comment is being written on | 4 |
| `src/web/components/DocumentView/useDocumentOverlay.ts` (new) | The hooks that draw over the doc | 4, 5 |
| `src/web/components/DocumentView/BlockTarget.tsx` (new) | The frame | 4 |
| `src/web/components/DocumentView/BlockCommentButton.tsx` (new) | The + and its frame | 4 |
| `src/web/components/DocumentView/useHoveredBlock.ts` | Returns a `BlockBox` | 4 |
| `src/web/components/DocumentView/DocumentControls.tsx` | Renders the frame, the +, the markers and Comment | 4, 5 |
| `src/web/components/DocumentView/DocumentView.tsx` | Uses `useDocumentOverlay` | 4, 5 |
| `src/web/review/HoveredThreadContext.ts` (new) | The hovered thread and its setter | 5 |
| `src/web/review/HoveredThreadProvider.tsx` (new) | Holds the hovered thread | 5 |
| `src/web/components/DocumentView/useHoveredThread.ts` (new) | The highlighted thread under the pointer | 5 |
| `src/web/components/DocumentView/ThreadMarkers.tsx` (new) | The numbered markers, with hover | 5 |
| `src/web/components/ThreadCard/ThreadCard.tsx`, `ThreadCard.module.css` | Card hover and focus | 5 |
| `src/web/components/App/App.tsx` | Wraps the columns in `HoveredThreadProvider` | 5 |
| `src/web/rendering/addHeadingLinks.ts` (new) | Heading links | 6 |
| `src/web/components/DocumentView/copyHeadingLink.ts` (new) | Copies the address after a heading link is clicked | 6 |
| `src/web/components/DocumentView/useDocumentClicks.ts` | Calls `copyHeadingLink` | 6 |
| `src/web/rendering/renderDocument.ts` | Adds heading links; renders frontmatter | 6, 10 |
| `src/web/rendering/renderMermaidDiagrams.ts` | Keeps definitions, redraws; `hasMermaidDiagrams` | 7 |
| `src/web/components/DocumentView/useMermaidDiagrams.ts` | Redraws on a colour-scheme change | 7 |
| `src/shared/markdown/anchoringVersion.ts` (new) | The canonical-text rules' version | 8 |
| `src/server/store/hashSource.ts` | Hashes the version with the source | 8 |
| `src/shared/markdown/frontMatterRule.ts` (new) | The frontmatter block rule | 10 |
| `src/shared/markdown/LeafBlock.ts`, `findLeafBlocks.ts`, `parseBlocks.ts`, `MarkdownBlock.ts` | The `frontMatter` leaf block | 10 |
| `src/web/rendering/readProperty.ts` (new) | Reads a frontmatter value for display | 10 |
| `src/web/rendering/renderFrontMatter.ts` (new) | Builds the Properties panel | 10 |
| `src/web/rendering/testing/conformanceCorpus.md` | Alerts and frontmatter cases | 9, 10 |
| `src/e2e/rendering.e2e.ts` (new) | Frontmatter and heading links in the browser | 6, 10 |
| `AGENTS.md`, `README.md`, design and side panel specs | Docs | 8, 11 |

---

### Task 1: Give block wrappers the prose gap, frame every code block the same way, and draw task-list checkboxes

**Files:**
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Modify: `src/web/global.css`
- Test: `src/e2e/layout.e2e.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: the selectors `.content div[data-md-block]` and `.content div[data-md-block] > pre`, which Task 3 builds on.

- [ ] **Step 1: Write the failing end-to-end test**

Add this test at the end of `src/e2e/layout.e2e.ts`, and this helper after the file's last function:

```ts
test("must leave the prose gap above a code block and between two code blocks in a row", async ({ page, review }) => {
  await review.writeDocument("docs/plan.md", "# Plan\n\nRun this:\n\n```\nplain code\n```\n\n    indented code\n");
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });

  const paragraphToFence = await gapBetween(article.locator('[data-md-block="1"]'), article.locator('[data-md-block="2"]'));
  const fenceToCode = await gapBetween(article.locator('[data-md-block="2"]'), article.locator('[data-md-block="3"]'));

  expect(paragraphToFence).toBeGreaterThanOrEqual(15);
  expect(fenceToCode).toBeGreaterThanOrEqual(15);
});
```

```ts
/**
 * @returns the space between the bottom of one block and the top of the block below it
 */
async function gapBetween(upper: Locator, lower: Locator): Promise<number> {
  const upperBox = await upper.boundingBox();
  const lowerBox = await lower.boundingBox();
  if (upperBox === null || lowerBox === null) {
    throw new Error("Both blocks must be on the page");
  }
  return lowerBox.y - (upperBox.y + upperBox.height);
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e src/e2e/layout.e2e.ts -g "prose gap"`
Expected: FAIL in Chromium and WebKit, with both gaps 0.

- [ ] **Step 3: Add the gap, the frame, Mermaid centring and the checkboxes**

In `src/web/components/DocumentView/DocumentView.module.css`, add these rules after the `.content` rule:

```css
/* markdown-it renders some blocks with no element of their own, so a wrapper carries their attributes and needs the
   gap Prose gives the elements it styles */
.content div[data-md-block]:not(:first-child) {
  margin-block-start: var(--sui-prose-flow);
}

/* Shiki writes its theme's background into the code block's style attribute */
.content div[data-md-block] > pre {
  background-color: var(--sui-color-surface) !important;
  border: var(--sui-border-width) solid var(--sui-color-border);
  border-radius: var(--sui-radius-lg);
  margin: 0;
}

.content div[data-md-block] > svg {
  display: block;
  margin-inline: auto;
}

/* Task-list checkboxes are disabled because they only show state, so they are drawn here rather than left greyed out */
.content input[type="checkbox"] {
  appearance: none;
  background-color: var(--sui-color-background);
  block-size: 1em;
  border: var(--sui-border-width) solid var(--sui-color-input-border);
  border-radius: var(--sui-radius-sm);
  cursor: default;
  display: inline-grid;
  inline-size: 1em;
  margin-block: 0;
  margin-inline: 0 0.25em;
  opacity: 1;
  place-content: center;
  vertical-align: -0.125em;
}

.content input[type="checkbox"]:checked {
  background-color: var(--sui-color-primary);
  border-color: var(--sui-color-primary);
}

.content input[type="checkbox"]:checked::before {
  background-color: var(--sui-color-on-primary);
  block-size: 0.75em;
  content: "";
  inline-size: 0.75em;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 8.5l3.2 3L13 4.5'/%3E%3C/svg%3E")
    center / contain no-repeat;
}
```

- [ ] **Step 4: Let the frame own the code background in both modes**

Replace the whole of `src/web/global.css` with:

```css
/* Shiki writes the dark theme's colours into custom properties, which take over when the system is in dark mode */
@media (prefers-color-scheme: dark) {
  .shiki,
  .shiki span {
    color: var(--shiki-dark) !important;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:e2e src/e2e/layout.e2e.ts`
Expected: PASS in Chromium and WebKit, including the existing layout tests.

- [ ] **Step 6: Run the web tests, lint and typecheck**

Run: `pnpm exec vitest run --project web && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Visual check**

Run the visual check from Global Constraints. Confirm:
- Every code block (TypeScript, plain fence, indented) has the same surface background, border and rounded corners, with a gap above it, in both modes.
- Highlighted tokens keep their colours in dark mode.
- The Mermaid diagram is centred, with a gap above it.
- Ticked tasks show a filled primary box with a tick, and open tasks an empty box, neither greyed out.

- [ ] **Step 8: Commit**

```bash
git add src/web/components/DocumentView/DocumentView.module.css src/web/global.css src/e2e/layout.e2e.ts
git commit -m "Give block wrappers the prose gap, frame all code alike, and draw task checkboxes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Restyle comment highlights, deepen them where threads overlap, and paint them in order

**Files:**
- Create: `src/web/anchoring/findOverlaps.ts`
- Create: `src/web/anchoring/findOverlaps.test.ts`
- Create: `src/web/components/DocumentView/useLayoutRevision.ts`
- Modify: `src/web/components/DocumentView/useThreadHighlights.ts`
- Modify: `src/web/components/DocumentView/DocumentView.tsx` (the `useThreadHighlights` call)
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Test: `src/web/components/DocumentView/DocumentView.test.tsx`

**Interfaces:**
- Produces:
  - `findOverlaps(ranges: readonly Range[]): Range[]`
  - `useLayoutRevision(elementRef: RefObject<HTMLElement | null>): number`, which Task 4 reuses
  - `useThreadHighlights(viewRef, contentRef, rendered, options: ThreadHighlightOptions): ThreadMarker[]`, where `ThreadHighlightOptions` is `{ pendingPassage: NewPassageAnchor | null; selectedThreadId: number | null; threads: readonly Thread[] }`. Task 5 adds `hoveredThreadId`.
  - `overlapHighlightName = "markdown-review-overlap"`

- [ ] **Step 1: Write the failing `findOverlaps` test**

Create `src/web/anchoring/findOverlaps.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { findOverlaps } from "./findOverlaps";

describe("findOverlaps", () => {
  test.each<{ condition: string; expected: string[]; spans: [number, number][] }>([
    { condition: "two ranges share text", expected: ["ef"], spans: [[2, 6], [4, 8]] },
    { condition: "two ranges are apart", expected: [], spans: [[0, 3], [5, 8]] },
    { condition: "two ranges only touch", expected: [], spans: [[0, 3], [3, 6]] },
    { condition: "one range holds another", expected: ["de"], spans: [[0, 10], [3, 5]] },
    { condition: "three ranges overlap", expected: ["cd", "d", "def"], spans: [[0, 4], [2, 6], [3, 8]] },
  ])("must return the text each pair shares when $condition", ({ expected, spans }) => {
    const text = document.createTextNode("abcdefghij");
    document.body.replaceChildren(text);

    const overlaps = findOverlaps(spans.map(([start, end]) => rangeOver(text, start, end)));

    expect(overlaps.map((range) => range.toString())).toEqual(expected);
  });
});

function rangeOver(node: Text, start: number, end: number): Range {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project web src/web/anchoring/findOverlaps.test.ts`
Expected: FAIL, because `./findOverlaps` does not exist.

- [ ] **Step 3: Implement `findOverlaps`**

Create `src/web/anchoring/findOverlaps.ts`:

```ts
/**
 * Finds the text that two of the given ranges both cover
 *
 * @param ranges ranges in the same document
 * @returns a range for each pair of ranges that share text, covering the text they share
 */
export function findOverlaps(ranges: readonly Range[]): Range[] {
  return ranges.flatMap((range, index) =>
    ranges.slice(index + 1).flatMap((other) => {
      const overlap = intersection(range, other);
      return overlap === null ? [] : [overlap];
    })
  );
}

function intersection(first: Range, second: Range): Range | null {
  const startsLater = first.compareBoundaryPoints(Range.START_TO_START, second) >= 0 ? first : second;
  const endsEarlier = first.compareBoundaryPoints(Range.END_TO_END, second) <= 0 ? first : second;
  const overlap = startsLater.cloneRange();
  overlap.setEnd(endsEarlier.endContainer, endsEarlier.endOffset);
  return overlap.collapsed ? null : overlap;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --project web src/web/anchoring/findOverlaps.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing overlap test in `DocumentView`**

In `src/web/components/DocumentView/DocumentView.test.tsx`:
- Add `overlapHighlightName` to the import from `./useThreadHighlights`, in alphabetical order.
- Add this anchor after `retriesAnchor`:

```ts
const todayAnchor = buildPassageAnchor({ anchoredText: "24h today", endOffset: 35, quote: "24h today", startOffset: 26 });
```

Add this test after "must highlight the passage of the comment the user is writing":

```ts
  test("must deepen the highlight where two threads' passages overlap", async () => {
    const { render } = setUpTest({
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), buildThread({ anchor: todayAnchor, id: 2 })],
    });

    await render();

    expect(elements.highlighted(overlapHighlightName)).toEqual(["24h"]);
  });
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView/DocumentView.test.tsx -t "overlap"`
Expected: FAIL, because `overlapHighlightName` is not exported.

- [ ] **Step 7: Extract `useLayoutRevision`**

Create `src/web/components/DocumentView/useLayoutRevision.ts`:

```ts
import type { RefObject } from "react";
import { useEffect, useState } from "react";

/**
 * Counts the times an element has changed size, so measurements of what it holds can be taken again
 *
 * @returns a number that changes whenever the element's size does
 */
export function useLayoutRevision(elementRef: RefObject<HTMLElement | null>): number {
  const [layoutRevision, setLayoutRevision] = useState(0);
  useEffect(() => {
    const element = elementRef.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(() => setLayoutRevision((revision) => revision + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);
  return layoutRevision;
}
```

- [ ] **Step 8: Paint the highlights in layers, with the overlap**

Replace `src/web/components/DocumentView/useThreadHighlights.ts` with:

```ts
import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { findOverlaps } from "../../anchoring/findOverlaps";
import { rangeForPassage } from "../../anchoring/rangeForPassage";

import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

export const threadsHighlightName = "markdown-review-threads";

export const overlapHighlightName = "markdown-review-overlap";

export const selectedHighlightName = "markdown-review-selected";

export const pendingHighlightName = "markdown-review-pending";

export interface ThreadMarker {
  /**
   * How many markers sit before this one on the same line
   */
  column: number;

  threadId: number;

  /**
   * Where the thread's passage starts, relative to the view
   */
  top: number;
}

export interface ThreadHighlightOptions {
  /**
   * The passage of the comment the user is writing on this doc, or null
   */
  pendingPassage: NewPassageAnchor | null;

  selectedThreadId: number | null;

  /**
   * The threads to highlight; a new array on every render would measure the page on every render
   */
  threads: readonly Thread[];
}

interface ThreadRange {
  range: Range;
  thread: Thread;
}

interface HighlightLayer {
  name: string;
  ranges: Range[];
}

/**
 * Highlights the threads' passages in the rendered doc, deeper where two overlap, the selected thread's apart from the
 * rest and the passage of the comment the user is writing apart again, and measures where each thread's passage starts
 * so the view can mark it
 *
 * @returns a marker for each thread's passage found in the page, top to bottom
 */
export function useThreadHighlights(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { pendingPassage, selectedThreadId, threads }: ThreadHighlightOptions
): ThreadMarker[] {
  const [markers, setMarkers] = useState<ThreadMarker[]>([]);
  const layoutRevision = useLayoutRevision(contentRef);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      setMarkers([]);
      return;
    }
    const ranges = threadRanges(content, rendered, threads);
    const isSelected = ({ thread }: ThreadRange): boolean => thread.id === selectedThreadId;
    const unselected = ranges.filter((range) => !isSelected(range)).map(({ range }) => range);
    const pendingRange =
      pendingPassage === null
        ? null
        : rangeForPassage(content, rendered.documentText, pendingPassage.startOffset, pendingPassage.endOffset);
    const names = paintHighlights([
      { name: threadsHighlightName, ranges: unselected },
      { name: overlapHighlightName, ranges: findOverlaps(unselected) },
      { name: selectedHighlightName, ranges: ranges.filter(isSelected).map(({ range }) => range) },
      { name: pendingHighlightName, ranges: pendingRange === null ? [] : [pendingRange] },
    ]);
    setMarkers(placeMarkers(ranges, view.getBoundingClientRect().top));
    return () => {
      for (const name of names) {
        CSS.highlights.delete(name);
      }
    };
  }, [contentRef, layoutRevision, pendingPassage, rendered, selectedThreadId, threads, viewRef]);
  return markers;
}

function threadRanges(
  content: HTMLElement,
  { documentText }: RenderedDocument,
  threads: readonly Thread[]
): ThreadRange[] {
  return threads.flatMap((thread): ThreadRange[] => {
    const { anchor } = thread;
    const range =
      anchor.kind === "passage" ? rangeForPassage(content, documentText, anchor.startOffset, anchor.endOffset) : null;
    return range === null ? [] : [{ range, thread }];
  });
}

/**
 * Registers the highlights so that each paints over the ones before it
 *
 * @returns the names registered
 */
function paintHighlights(layers: readonly HighlightLayer[]): string[] {
  return layers.map(({ name, ranges }, priority) => {
    const highlight = new Highlight(...ranges);
    highlight.priority = priority;
    CSS.highlights.set(name, highlight);
    return name;
  });
}

function placeMarkers(ranges: readonly ThreadRange[], viewTop: number): ThreadMarker[] {
  const placed = ranges
    .map(({ range, thread }) => ({
      threadId: thread.id,
      top: (range.getClientRects()[0] ?? range.getBoundingClientRect()).top - viewTop,
    }))
    .sort((left, right) => left.top - right.top || left.threadId - right.threadId);
  let column = 0;
  return placed.map((marker, index) => {
    const previous = placed[index - 1];
    column = previous !== undefined && Math.abs(marker.top - previous.top) < 4 ? column + 1 : 0;
    return { ...marker, column };
  });
}
```

In `src/web/components/DocumentView/DocumentView.tsx`, change the call to:

```tsx
  const markers = useThreadHighlights(viewRef, contentRef, rendered, {
    pendingPassage,
    selectedThreadId,
    threads: highlightedThreads,
  });
```

- [ ] **Step 9: Restyle the highlights**

In `src/web/components/DocumentView/DocumentView.module.css`, replace the three `::highlight` rules with:

```css
.content ::highlight(markdown-review-threads) {
  background-color: color-mix(in srgb, var(--sui-color-warning) 30%, transparent);
  text-decoration-color: var(--sui-color-warning-text);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.content ::highlight(markdown-review-overlap) {
  background-color: color-mix(in srgb, var(--sui-color-warning) 30%, transparent);
}

.content ::highlight(markdown-review-selected) {
  background-color: color-mix(in srgb, var(--sui-color-primary) 25%, transparent);
  text-decoration-color: var(--sui-color-primary);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.content ::highlight(markdown-review-pending) {
  background-color: color-mix(in srgb, var(--sui-color-primary) 25%, transparent);
  text-decoration-color: var(--sui-color-primary);
  text-decoration-line: underline;
  text-decoration-style: dashed;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView src/web/anchoring`
Expected: PASS, including the existing highlight tests.

- [ ] **Step 11: Lint, typecheck and visual check**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

Run the visual check. In the corpus page:
- Select some text and press Comment to see the pending highlight.
- Save a comment that overlaps the first, and select one of the two threads.

Confirm, in both modes and in Chrome and Safari:
- Unselected threads show an amber tint with a solid amber underline.
- The selected thread shows a blue tint with a solid blue underline.
- The pending passage has a dashed blue underline.
- Text under both comments is a deeper amber.
- Where the selected thread overlaps the other one, the shared text is blue, not amber. This checks that Safari honours the highlights' `priority`. If it does not, registering the highlights in the same order still paints selected last, so note what you see in the commit message and carry on.

- [ ] **Step 12: Commit**

```bash
git add src/web/anchoring/findOverlaps.ts src/web/anchoring/findOverlaps.test.ts src/web/components/DocumentView
git commit -m "Underline comment highlights, deepen overlaps, and paint highlights in order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Show the language of a fenced code block in a header

**Files:**
- Modify: `src/shared/markdown/createMarkdownIt.ts`
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Test: `src/web/rendering/renderDocument.test.ts`

**Interfaces:**
- Produces: a `data-language` attribute on fence wrappers, holding the fence's language as written, except for Mermaid and unlabelled fences. Task 10 sets the same attribute to `frontmatter` on the frontmatter fallback.

- [ ] **Step 1: Write the failing test**

Add to `src/web/rendering/renderDocument.test.ts`, after the existing fence tests:

```ts
  test.each([
    { condition: "names a language Shiki knows", expected: "TS", fence: "```TS\nconst ttl = 3600;\n```\n" },
    { condition: "names a language Shiki does not know", expected: "not-a-language", fence: "```not-a-language\nx\n```\n" },
    { condition: "names no language", expected: null, fence: "```\nx\n```\n" },
    { condition: "holds a Mermaid diagram", expected: null, fence: "```mermaid\ngraph TD\n```\n" },
    { condition: "names a language holding markup", expected: '"><b>x', fence: '```"><b>x\ny\n```\n' },
  ])("must give the fence's language to its header when the fence $condition", async ({ expected, fence }) => {
    const page = await renderPage(fence);

    expect(page.querySelector('[data-md-block="0"]')?.getAttribute("data-language")).toBe(expected);
    expect(page.querySelector("b")).toBeNull();
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project web src/web/rendering/renderDocument.test.ts -t "header"`
Expected: FAIL. The first, second and fifth cases get `null` where a language was expected.

- [ ] **Step 3: Add the attribute in the fence rule**

In `src/shared/markdown/createMarkdownIt.ts`, change `renderFence` to:

```ts
  const renderFence: RendererRule = (tokens, index, _options, _environment, renderer) => {
    const token = tokenAt(tokens, index);
    const code = withoutFinalNewline(token.content);
    const language = fenceLanguage(token.info);
    const languageClass = language === "" ? "" : ` class="language-${escapeHtml(language)}"`;
    const languageHeader =
      language === "" || language === "mermaid" ? "" : ` data-language="${escapeHtml(language)}"`;
    const highlighted = highlight?.(code, language) ?? `<pre><code${languageClass}>${escapeHtml(code)}</code></pre>`;
    return `<div${renderer.renderAttrs(token)}${languageHeader}>${highlighted}</div>\n`;
  };
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --project web src/web/rendering`
Expected: PASS, including the conformance test.

- [ ] **Step 5: Draw the header**

Add to `src/web/components/DocumentView/DocumentView.module.css`, after the `.content div[data-md-block] > pre` rule:

```css
.content div[data-language]:has(> pre)::before {
  background-color: color-mix(in srgb, var(--sui-color-surface), var(--sui-color-text) 5%);
  border: var(--sui-border-width) solid var(--sui-color-border);
  border-block-end: none;
  border-start-end-radius: var(--sui-radius-lg);
  border-start-start-radius: var(--sui-radius-lg);
  color: var(--sui-color-text-muted);
  content: attr(data-language);
  display: block;
  font-family: var(--sui-font-mono);
  font-size: 0.75rem;
  padding: var(--sui-space-1) var(--sui-space-4);
}

.content div[data-language]:has(> pre) > pre {
  border-start-end-radius: 0;
  border-start-start-radius: 0;
}
```

- [ ] **Step 6: Lint, typecheck and visual check**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

Run the visual check. Confirm:
- The `ts` fence has a header reading "ts" that joins its frame.
- The plain fence and the indented code have no header.
- The Mermaid diagram has none.
- Selecting text across the code doesn't select the header.

- [ ] **Step 7: Commit**

```bash
git add src/shared/markdown/createMarkdownIt.ts src/web/components/DocumentView/DocumentView.module.css src/web/rendering/renderDocument.test.ts
git commit -m "Show a fenced code block's language in a header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Frame the block the + will comment on, and keep it framed while the comment is written

**Files:**
- Create: `src/web/components/DocumentView/BlockBox.ts`
- Create: `src/web/components/DocumentView/measureBlock.ts`
- Create: `src/web/anchoring/wholeBlockIndex.ts`
- Create: `src/web/anchoring/wholeBlockIndex.test.ts`
- Create: `src/web/components/DocumentView/usePendingBlock.ts`
- Create: `src/web/components/DocumentView/useDocumentOverlay.ts`
- Create: `src/web/components/DocumentView/BlockTarget.tsx`
- Create: `src/web/components/DocumentView/BlockCommentButton.tsx`
- Modify: `src/web/components/DocumentView/useHoveredBlock.ts`
- Modify: `src/web/components/DocumentView/DocumentControls.tsx`
- Modify: `src/web/components/DocumentView/DocumentView.tsx`
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Test: `src/web/components/DocumentView/DocumentView.test.tsx`
- Test: `src/e2e/comments.e2e.ts`

**Interfaces:**
- Consumes: `useLayoutRevision` (Task 2), and `useThreadHighlights(viewRef, contentRef, rendered, { pendingPassage, selectedThreadId, threads })` (Task 2).
- Produces:
  - `interface BlockBox { height: number; index: number; left: number; top: number; width: number }`
  - `measureBlock(view: Element, block: Element): BlockBox`
  - `wholeBlockIndex(documentText: DocumentText, startOffset: number, endOffset: number): number | null`
  - `usePendingBlock(viewRef, contentRef, rendered, pendingPassage): BlockBox | null`
  - `useDocumentOverlay(viewRef, contentRef, rendered, options: DocumentOverlayOptions): DocumentOverlay`
    - `DocumentOverlayOptions` is `{ documentPath: string; highlightedThreads: readonly Thread[]; pendingPassage: NewPassageAnchor | null; selectedThreadId: number | null }`.
    - `DocumentOverlay` is `{ hoveredBlock: BlockBox | null; markers: ThreadMarker[]; pendingBlock: BlockBox | null; selectionComment: SelectionComment | null }`. Task 5 adds `isPointingAtHighlight`.
  - `useHoveredBlock(viewRef, contentRef): BlockBox | null`; the `HoveredBlock` type is removed.
  - `BlockTarget({ box })`, rendered with `data-testid="block-target"`
  - `BlockCommentButton({ block, isFramed, onComment })`

- [ ] **Step 1: Write the failing `wholeBlockIndex` test**

Create `src/web/anchoring/wholeBlockIndex.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";

import { wholeBlockIndex } from "./wholeBlockIndex";

const documentText = createDocumentText("# Plan\n\nRetries happen three times.\n");

describe("wholeBlockIndex", () => {
  test.each([
    { condition: "the passage is a block's whole text", endOffset: 32, expected: 1, startOffset: 5 },
    { condition: "the passage is part of a block", endOffset: 12, expected: null, startOffset: 5 },
    { condition: "the passage runs across two blocks", endOffset: 32, expected: null, startOffset: 0 },
  ])("must return $expected when $condition", ({ endOffset, expected, startOffset }) => {
    expect(wholeBlockIndex(documentText, startOffset, endOffset)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project web src/web/anchoring/wholeBlockIndex.test.ts`
Expected: FAIL, because `./wholeBlockIndex` does not exist.

- [ ] **Step 3: Implement `wholeBlockIndex`**

Create `src/web/anchoring/wholeBlockIndex.ts`:

```ts
import type { DocumentText } from "../../shared/markdown/DocumentText";

/**
 * Finds the block whose whole text a passage covers, as a comment started with + beside a block does
 *
 * @param documentText the doc's canonical text
 * @param startOffset where the passage starts in the canonical text
 * @param endOffset where it ends, exclusive
 * @returns the block's index, or null when the passage is not exactly one block's text
 */
export function wholeBlockIndex(documentText: DocumentText, startOffset: number, endOffset: number): number | null {
  const index = documentText.blockStartOffsets.indexOf(startOffset);
  const block = documentText.blocks[index];
  return block !== undefined && startOffset + block.text.length === endOffset ? index : null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --project web src/web/anchoring/wholeBlockIndex.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing `DocumentView` tests**

Add to `src/web/components/DocumentView/DocumentView.test.tsx`, after "must start a comment on the whole block when the user presses + beside it":

```ts
  test("must frame the block while the pointer is on its +", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));

    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));

    expect(screen.getByTestId("block-target")).toBeInTheDocument();
  });

  test("must stop framing the block when the pointer leaves its +", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    const block = within(elements.article()).getByText("Retries happen three times.");
    await user.hover(block);
    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));

    await user.hover(block);

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });

  test("must keep the block framed while the user writes a comment on the whole of it", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 84,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries happen three times.",
        startOffset: 57,
        suffix: "",
      },
    });

    await render();

    expect(await screen.findByTestId("block-target")).toBeInTheDocument();
  });

  test("must not frame a block while the user writes a comment on part of it", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 64,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries",
        startOffset: 57,
        suffix: " happen three times.",
      },
    });

    await render();

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView/DocumentView.test.tsx -t "fram"`
Expected: FAIL. No element has the test ID `block-target`; the last test passes already.

- [ ] **Step 7: Add `BlockBox` and `measureBlock`**

Create `src/web/components/DocumentView/BlockBox.ts`:

```ts
/**
 * Where a block of the rendered doc is, relative to the view that holds the doc and its controls
 */
export interface BlockBox {
  height: number;

  /**
   * The block's index, as its `data-md-block` gives it
   */
  index: number;

  left: number;
  top: number;
  width: number;
}
```

Create `src/web/components/DocumentView/measureBlock.ts`:

```ts
import type { BlockBox } from "./BlockBox";

/**
 * Measures where a block of the rendered doc is
 *
 * @param view the element that holds the doc and its controls
 * @param block the element carrying the block's `data-md-block`
 * @returns the block's box, relative to the view
 */
export function measureBlock(view: Element, block: Element): BlockBox {
  const viewBox = view.getBoundingClientRect();
  const { height, left, top, width } = block.getBoundingClientRect();
  return {
    height,
    index: Number(block.getAttribute("data-md-block")),
    left: left - viewBox.left,
    top: top - viewBox.top,
    width,
  };
}
```

- [ ] **Step 8: Make `useHoveredBlock` return a `BlockBox`**

Replace `src/web/components/DocumentView/useHoveredBlock.ts` with:

```ts
import type { RefObject } from "react";
import { useEffect, useState } from "react";

import { blockElementAt } from "../../anchoring/blockElementAt";

import type { BlockBox } from "./BlockBox";
import { measureBlock } from "./measureBlock";

/**
 * Follows the block under the pointer, so the view can offer a comment on the whole block beside it
 *
 * @returns where the block is, or null when the pointer has left the view
 */
export function useHoveredBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): BlockBox | null {
  const [hoveredBlock, setHoveredBlock] = useState<BlockBox | null>(null);
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null) {
      return;
    }
    const enter = (event: MouseEvent): void => {
      const block = event.target instanceof Node ? blockElementAt(content, event.target) : null;
      if (block !== null) {
        setHoveredBlock(measureBlock(view, block));
      }
    };
    const leave = (): void => setHoveredBlock(null);
    content.addEventListener("mouseover", enter);
    view.addEventListener("mouseleave", leave);
    return () => {
      content.removeEventListener("mouseover", enter);
      view.removeEventListener("mouseleave", leave);
    };
  }, [contentRef, viewRef]);
  return hoveredBlock;
}
```

- [ ] **Step 9: Add `usePendingBlock`**

Create `src/web/components/DocumentView/usePendingBlock.ts`:

```ts
import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import { wholeBlockIndex } from "../../anchoring/wholeBlockIndex";

import type { BlockBox } from "./BlockBox";
import { measureBlock } from "./measureBlock";
import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Measures the block a whole-block comment is being written on, so the view can keep it framed
 *
 * @param pendingPassage the passage of the comment the user is writing on this doc, or null
 * @returns where the block is, or null when the comment is not on exactly one block's whole text
 */
export function usePendingBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  pendingPassage: NewPassageAnchor | null
): BlockBox | null {
  const [pendingBlock, setPendingBlock] = useState<BlockBox | null>(null);
  const layoutRevision = useLayoutRevision(contentRef);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const index =
      rendered === null || pendingPassage === null
        ? null
        : wholeBlockIndex(rendered.documentText, pendingPassage.startOffset, pendingPassage.endOffset);
    const block = index === null ? null : (contentRef.current?.querySelector(`[data-md-block="${index}"]`) ?? null);
    setPendingBlock(view === null || block === null ? null : measureBlock(view, block));
  }, [contentRef, layoutRevision, pendingPassage, rendered, viewRef]);
  return pendingBlock;
}
```

- [ ] **Step 10: Add `useDocumentOverlay`**

Create `src/web/components/DocumentView/useDocumentOverlay.ts`:

```ts
import type { RefObject } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";

import type { BlockBox } from "./BlockBox";
import { useHoveredBlock } from "./useHoveredBlock";
import { usePendingBlock } from "./usePendingBlock";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import { useSelectionComment } from "./useSelectionComment";
import type { ThreadMarker } from "./useThreadHighlights";
import { useThreadHighlights } from "./useThreadHighlights";

export interface DocumentOverlayOptions {
  /**
   * The doc's repo-relative path
   */
  documentPath: string;

  /**
   * The threads whose passages are highlighted; a new array on every render would measure the page on every render
   */
  highlightedThreads: readonly Thread[];

  /**
   * The passage of the comment the user is writing on this doc, or null
   */
  pendingPassage: NewPassageAnchor | null;

  selectedThreadId: number | null;
}

export interface DocumentOverlay {
  /**
   * The block under the pointer, or null
   */
  hoveredBlock: BlockBox | null;

  markers: ThreadMarker[];

  /**
   * The block a whole-block comment is being written on, or null
   */
  pendingBlock: BlockBox | null;

  selectionComment: SelectionComment | null;
}

/**
 * Follows what is drawn over the rendered doc: the threads' highlights and markers, the block under the pointer, the
 * block a comment is being written on, and the Comment button beside selected text
 */
export function useDocumentOverlay(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { documentPath, highlightedThreads, pendingPassage, selectedThreadId }: DocumentOverlayOptions
): DocumentOverlay {
  const markers = useThreadHighlights(viewRef, contentRef, rendered, {
    pendingPassage,
    selectedThreadId,
    threads: highlightedThreads,
  });
  const selectionComment = useSelectionComment(viewRef, contentRef, rendered, documentPath);
  const hoveredBlock = useHoveredBlock(viewRef, contentRef);
  const pendingBlock = usePendingBlock(viewRef, contentRef, rendered, pendingPassage);
  return { hoveredBlock, markers, pendingBlock, selectionComment };
}
```

- [ ] **Step 11: Add `BlockTarget` and `BlockCommentButton`**

Create `src/web/components/DocumentView/BlockTarget.tsx`:

```tsx
import type { JSX } from "react";

import type { BlockBox } from "./BlockBox";
import styles from "./DocumentView.module.css";

const horizontalOutset = 4;

const verticalOutset = 6;

export interface BlockTargetProps {
  box: BlockBox;
}

/**
 * Frames the block a whole-block comment is for
 */
export function BlockTarget({ box }: BlockTargetProps): JSX.Element {
  return (
    <div
      className={styles.blockTarget}
      style={{
        height: box.height + 2 * verticalOutset,
        left: box.left - horizontalOutset,
        top: box.top - verticalOutset,
        width: box.width + 2 * horizontalOutset,
      }}
      aria-hidden="true"
      data-md-ignore=""
      data-testid="block-target"
    />
  );
}
```

Create `src/web/components/DocumentView/BlockCommentButton.tsx`:

```tsx
import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { BlockBox } from "./BlockBox";
import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";

export interface BlockCommentButtonProps {
  block: BlockBox;

  /**
   * Whether the block is framed already, because a comment is being written on it
   */
  isFramed: boolean;

  onComment: () => void;
}

/**
 * The + beside the block under the pointer, which frames the block while the user points at it or focuses it
 */
export function BlockCommentButton({ block, isFramed, onComment }: BlockCommentButtonProps): JSX.Element {
  const [isTargeting, setIsTargeting] = useState(false);
  return (
    <>
      {isTargeting && !isFramed && <BlockTarget box={block} />}
      <Button
        className={styles.blockButton}
        onBlur={() => setIsTargeting(false)}
        onClick={onComment}
        onFocus={() => setIsTargeting(true)}
        onPointerEnter={() => setIsTargeting(true)}
        onPointerLeave={() => setIsTargeting(false)}
        size="sm"
        style={{ top: block.top }}
        variant="ghost"
        aria-label="Comment on this block"
        data-md-ignore=""
      >
        +
      </Button>
    </>
  );
}
```

- [ ] **Step 12: Render them from `DocumentControls`**

Replace `src/web/components/DocumentView/DocumentControls.tsx` with:

```tsx
import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { blockPassage } from "../../anchoring/blockPassage";
import type { NewComment } from "../../review/NewComment";

import type { BlockBox } from "./BlockBox";
import { BlockCommentButton } from "./BlockCommentButton";
import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import type { ThreadMarker } from "./useThreadHighlights";

export interface DocumentControlsProps {
  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

  /**
   * The block under the pointer, or null
   */
  hoveredBlock: BlockBox | null;

  markers: ThreadMarker[];
  onComment: (newComment: NewComment) => void;
  onSelectThread: (threadId: number) => void;

  /**
   * The block a whole-block comment is being written on, or null
   */
  pendingBlock: BlockBox | null;

  /**
   * The doc on the page, or null until it has rendered
   */
  rendered: RenderedDocument | null;

  selectedThreadId: number | null;
  selectionComment: SelectionComment | null;
}

/**
 * The controls laid over the rendered doc: + beside the block under the pointer, a frame around the block a comment is
 * for, a numbered marker beside each thread's passage, and Comment beside the selected text
 */
export function DocumentControls({
  document: shown,
  hoveredBlock,
  markers,
  onComment,
  onSelectThread,
  pendingBlock,
  rendered,
  selectedThreadId,
  selectionComment,
}: DocumentControlsProps): JSX.Element {
  const commentOnBlock = (blockIndex: number): void => {
    const anchor = rendered === null ? null : blockPassage(rendered.documentText, shown.path, blockIndex);
    if (anchor !== null) {
      onComment({ anchor, renderedHash: shown.hash });
    }
  };
  const commentOnSelection = ({ anchor }: SelectionComment): void => {
    onComment({ anchor, renderedHash: shown.hash });
    document.getSelection()?.removeAllRanges();
  };
  return (
    <>
      {pendingBlock !== null && <BlockTarget box={pendingBlock} />}
      {hoveredBlock !== null && (
        <BlockCommentButton
          block={hoveredBlock}
          isFramed={pendingBlock?.index === hoveredBlock.index}
          key={hoveredBlock.index}
          onComment={() => commentOnBlock(hoveredBlock.index)}
        />
      )}
      {markers.map(({ column, threadId, top }) => (
        <Button
          className={styles.marker}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          size="sm"
          style={{ insetInlineEnd: `${column * 2}rem`, top }}
          variant={threadId === selectedThreadId ? "primary" : "secondary"}
          aria-label={`Thread #${threadId}`}
          aria-pressed={threadId === selectedThreadId}
          data-md-ignore=""
        >
          {threadId}
        </Button>
      ))}
      {selectionComment !== null && (
        <Button
          className={styles.selectionButton}
          onClick={() => commentOnSelection(selectionComment)}
          onMouseDown={(event) => event.preventDefault()}
          size="sm"
          // Moves left by however much of the button would stick out past the view, as a translate's percentage is of
          // the button's own width
          style={{
            left: selectionComment.left,
            top: selectionComment.top,
            translate: `min(0px, ${selectionComment.roomToRight}px - 100%)`,
          }}
          data-md-ignore=""
        >
          Comment
        </Button>
      )}
    </>
  );
}
```

- [ ] **Step 13: Use `useDocumentOverlay` in `DocumentView`**

In `src/web/components/DocumentView/DocumentView.tsx`:
- Replace the imports of `useHoveredBlock`, `useSelectionComment` and `useThreadHighlights` with `import { useDocumentOverlay } from "./useDocumentOverlay";`, placed after the `useDocumentNavigation` import.
- Replace the `markers`, `selectionComment` and `hoveredBlock` lines with:

```tsx
  const overlay = useDocumentOverlay(viewRef, contentRef, rendered, {
    documentPath: shown.path,
    highlightedThreads,
    pendingPassage,
    selectedThreadId,
  });
```

Then change the `DocumentControls` element to:

```tsx
        <DocumentControls
          document={shown}
          hoveredBlock={overlay.hoveredBlock}
          markers={overlay.markers}
          onComment={onComment}
          onSelectThread={onSelectThread}
          pendingBlock={overlay.pendingBlock}
          rendered={rendered}
          selectedThreadId={selectedThreadId}
          selectionComment={overlay.selectionComment}
        />
```

- [ ] **Step 14: Style the frame**

Add to `src/web/components/DocumentView/DocumentView.module.css`, after the `.selectionButton` rule:

```css
.blockTarget {
  background-color: color-mix(in srgb, var(--sui-color-primary) 7%, transparent);
  border: 2px solid var(--sui-color-primary);
  border-radius: var(--sui-radius-lg);
  pointer-events: none;
  position: absolute;
}

@media (prefers-reduced-motion: no-preference) {
  .blockTarget {
    animation: fadeIn 120ms ease-out;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
}
```

- [ ] **Step 15: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView src/web/anchoring`
Expected: PASS.

- [ ] **Step 16: Write and run the end-to-end test**

Add to `src/e2e/comments.e2e.ts`:

```ts
test("must frame a block while the user points at the + beside it", async ({ page, review }) => {
  await review.open("docs/plan.md");

  await page.getByRole("article", { name: "docs/plan.md" }).getByText("Retries happen three times.").hover();
  await page.getByRole("button", { name: "Comment on this block" }).hover();

  await expect(page.getByTestId("block-target")).toBeVisible();
});
```

Run: `pnpm test:e2e src/e2e/comments.e2e.ts`
Expected: PASS in Chromium and WebKit.

- [ ] **Step 17: Check complexity, lint and typecheck**

Run: `pnpm exec fallow health src/web/components/DocumentView --complexity`
Expected: no function over cyclomatic 20 or cognitive 15. `DocumentView` is at 13.

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 18: Visual check**

Run the visual check. Confirm:
- Pointing at the + beside a paragraph, a list item, a table row and a code block frames that block with a blue ring and a faint fill, clear of the + and the markers.
- The frame fades in.
- Pressing + keeps the frame while the composer is open, and Cancel removes it.

- [ ] **Step 19: Commit**

```bash
git add src/web/anchoring/wholeBlockIndex.ts src/web/anchoring/wholeBlockIndex.test.ts src/web/components/DocumentView src/e2e/comments.e2e.ts
git commit -m "Frame the block the + comments on, and keep it framed while the comment is written

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Link a highlight and its card while the user points at either

**Files:**
- Create: `src/web/review/HoveredThreadContext.ts`
- Create: `src/web/review/HoveredThreadProvider.tsx`
- Create: `src/web/components/DocumentView/useHoveredThread.ts`
- Create: `src/web/components/DocumentView/ThreadMarkers.tsx`
- Modify: `src/web/components/DocumentView/useThreadHighlights.ts`
- Modify: `src/web/components/DocumentView/useDocumentOverlay.ts`
- Modify: `src/web/components/DocumentView/DocumentControls.tsx`
- Modify: `src/web/components/DocumentView/DocumentView.tsx`
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Modify: `src/web/components/ThreadCard/ThreadCard.tsx`
- Modify: `src/web/components/ThreadCard/ThreadCard.module.css`
- Modify: `src/web/components/App/App.tsx`
- Test: `src/web/components/DocumentView/DocumentView.test.tsx`
- Test: `src/web/components/ThreadCard/ThreadCard.test.tsx`
- Test: `src/e2e/comments.e2e.ts`

**Interfaces:**
- Consumes: `useDocumentOverlay` and `DocumentOverlay` (Task 4); `ThreadHighlightOptions` (Task 2).
- Produces:
  - `interface HoveredThread { hoveredThreadId: number | null; onHoverThread: (threadId: number | null) => void }`
  - `HoveredThreadContext`, whose default is no hovered thread and an `onHoverThread` that does nothing
  - `HoveredThreadProvider({ children })`
  - `useHoveredThread(contentRef, rendered, highlightedThreads, onHoverThread): boolean`
  - `hoveredHighlightName = "markdown-review-hovered"`
  - `ThreadHighlightOptions` gains `hoveredThreadId: number | null`
  - `DocumentOverlay` gains `isPointingAtHighlight: boolean`
  - `ThreadMarkers({ markers, onSelectThread, selectedThreadId })`

- [ ] **Step 1: Write the failing `ThreadCard` tests**

In `src/web/components/ThreadCard/ThreadCard.test.tsx`, import the context:

```ts
import { HoveredThreadContext } from "../../review/HoveredThreadContext";
```

Change `setUpTest` to create `onHoverThread`, wrap the card in the context, and return it:

```tsx
function setUpTest({ hasNewAgentMessage = false, thread }: { hasNewAgentMessage?: boolean; thread: Thread }) {
  const fake = createFakeReviewApi({ threads: [thread] });
  const onChanged = vi.fn();
  const onHoverThread = vi.fn();
  const onSelect = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <HoveredThreadContext value={{ hoveredThreadId: null, onHoverThread }}>
          <CommentEditorHarness onChanged={onChanged} threads={[thread]}>
            {() => (
              <ThreadCard
                hasNewAgentMessage={hasNewAgentMessage}
                isSelected={false}
                onChanged={onChanged}
                onSelect={onSelect}
                thread={thread}
              />
            )}
          </CommentEditorHarness>
        </HoveredThreadContext>
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onHoverThread, onSelect, render };
}
```

Add these tests at the end of the `describe`:

```ts
  test("must report its thread as hovered when the pointer moves onto the card", async () => {
    const { onHoverThread, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.hover(screen.getByRole("article"));

    expect(onHoverThread).toHaveBeenLastCalledWith(1);
  });

  test("must report no hovered thread when the pointer leaves the card", async () => {
    const { onHoverThread, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();
    await user.hover(screen.getByRole("article"));

    await user.unhover(screen.getByRole("article"));

    expect(onHoverThread).toHaveBeenLastCalledWith(null);
  });

  test("must report its thread as hovered when the keyboard focus moves into the card", async () => {
    const { onHoverThread, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.tab();

    expect(onHoverThread).toHaveBeenLastCalledWith(1);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/components/ThreadCard/ThreadCard.test.tsx`
Expected: FAIL, because `../../review/HoveredThreadContext` does not exist.

- [ ] **Step 3: Add the context and its provider**

Create `src/web/review/HoveredThreadContext.ts`:

```ts
import { createContext } from "react";

export interface HoveredThread {
  /**
   * The thread under the pointer or the keyboard focus, in the doc or the comments, or null
   */
  hoveredThreadId: number | null;

  /**
   * Called with a thread when the pointer or the focus moves onto it, and with null when it leaves
   */
  onHoverThread: (threadId: number | null) => void;
}

/**
 * The thread the user is pointing at, shared by the doc and the comments so each can emphasise it; without a provider,
 * nothing is hovered
 */
export const HoveredThreadContext = createContext<HoveredThread>({ hoveredThreadId: null, onHoverThread: () => {} });
```

Create `src/web/review/HoveredThreadProvider.tsx`:

```tsx
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import { HoveredThreadContext } from "./HoveredThreadContext";

export interface HoveredThreadProviderProps {
  children: ReactNode;
}

/**
 * Holds the thread the user is pointing at, for the doc and the comments inside it
 */
export function HoveredThreadProvider({ children }: HoveredThreadProviderProps): JSX.Element {
  const [hoveredThreadId, setHoveredThreadId] = useState<number | null>(null);
  return (
    <HoveredThreadContext value={{ hoveredThreadId, onHoverThread: setHoveredThreadId }}>
      {children}
    </HoveredThreadContext>
  );
}
```

- [ ] **Step 4: Report and show hover on thread cards**

In `src/web/components/ThreadCard/ThreadCard.tsx`:
- Change the React import to `import { useContext, useEffect, useRef } from "react";`.
- Add `import { HoveredThreadContext } from "../../review/HoveredThreadContext";` before the `describeLocation` import.
- In `ThreadCard`, after `const editor = useCommentEditorContext();`, add:

```tsx
  const { hoveredThreadId, onHoverThread } = useContext(HoveredThreadContext);
```

Replace the `<Card …>` opening tag with:

```tsx
    <Card
      as="article"
      className={clsx(styles.card, {
        [styles.editing ?? ""]: editor.editingThreadId === id,
        [styles.hovered ?? ""]: hoveredThreadId === id,
        [styles.selected ?? ""]: isSelected,
      })}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onHoverThread(null);
        }
      }}
      onFocus={() => onHoverThread(id)}
      onPointerEnter={() => onHoverThread(id)}
      onPointerLeave={() => onHoverThread(null)}
      padding="sm"
      ref={cardRef}
      aria-label={`Thread #${id}`}
    >
```

In `src/web/components/ThreadCard/ThreadCard.module.css`, add after the `.card` rule:

```css
.hovered {
  --sui-card-bg: var(--sui-color-secondary-subtle);
}
```

- [ ] **Step 5: Run the `ThreadCard` tests to verify they pass**

Run: `pnpm exec vitest run --project web src/web/components/ThreadCard/ThreadCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Write the failing `DocumentView` tests**

In `src/web/components/DocumentView/DocumentView.test.tsx`:
- Import `HoveredThreadContext` from `../../review/HoveredThreadContext`.
- Add `hoveredHighlightName` to the import from `./useThreadHighlights`.
- Add `hoveredThreadId?: number | null;` to `SetUpOptions`.
- Change `setUpTest` to:

```tsx
function setUpTest({
  container,
  hash = "",
  hoveredThreadId = null,
  pendingPassage = null,
  selectedThreadId = null,
  threads = [],
}: SetUpOptions = {}) {
  const onComment = vi.fn();
  const onHoverThread = vi.fn();
  const onNavigate = vi.fn();
  const onSelectThread = vi.fn();
  const view = (shown: DocumentSource) => (
    <HoveredThreadContext value={{ hoveredThreadId, onHoverThread }}>
      <DocumentView
        document={shown}
        hash={hash}
        onComment={onComment}
        onNavigate={onNavigate}
        onSelectThread={onSelectThread}
        pendingPassage={pendingPassage}
        revealCount={0}
        selectedThreadId={selectedThreadId}
        threads={threads}
      />
    </HoveredThreadContext>
  );
  let rerenderBase: (ui: ReturnType<typeof view>) => void = () => {};
  const render = async (shown = plan): Promise<void> => {
    rerenderBase = renderBase(view(shown), { container }).rerender;
    if (shown.source !== "") {
      await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
    }
  };
  const rerender = async (shown: DocumentSource): Promise<void> => {
    rerenderBase(view(shown));
    await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
  };
  return { onComment, onHoverThread, onNavigate, onSelectThread, render, rerender };
}
```

Add these tests after "must select a thread when the user clicks its highlighted text":

```ts
  test("must report the thread whose highlight the pointer moves over", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });

    await user.hover(passage);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
  });

  test("must report no hovered thread when the pointer leaves the doc", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await user.unhover(passage);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must emphasise the passage of the thread the user points at in the comments", async () => {
    const { render } = setUpTest({
      hoveredThreadId: 1,
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), buildThread({ anchor: retriesAnchor, id: 2 })],
    });

    await render();

    expect(elements.highlighted(hoveredHighlightName)).toEqual(["cache results for 24h"]);
    expect(elements.highlighted(threadsHighlightName)).toEqual(["Retries"]);
  });

  test("must report a thread as hovered when the pointer is over its marker", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();

    await user.hover(screen.getByRole("button", { name: "Thread #1" }));

    expect(onHoverThread).toHaveBeenLastCalledWith(1);
  });
```

- [ ] **Step 7: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView/DocumentView.test.tsx -t "hover|points at"`
Expected: FAIL, because `hoveredHighlightName` is not exported and nothing calls `onHoverThread`.

- [ ] **Step 8: Add the hovered layer to `useThreadHighlights`**

In `src/web/components/DocumentView/useThreadHighlights.ts`:
- After `overlapHighlightName`, add:

```ts
export const hoveredHighlightName = "markdown-review-hovered";
```

- Add this field to `ThreadHighlightOptions`, before `pendingPassage`:

```ts
  /**
   * The thread the user is pointing at, in the doc or the comments, or null
   */
  hoveredThreadId: number | null;
```

- Replace the function's parameter destructuring with `{ hoveredThreadId, pendingPassage, selectedThreadId, threads }: ThreadHighlightOptions`.
- Replace the lines from `const isSelected` through the `paintHighlights` call with:

```ts
    const rangesIn = (name: string): Range[] =>
      ranges
        .filter(({ thread }) => highlightOf(thread.id, selectedThreadId, hoveredThreadId) === name)
        .map(({ range }) => range);
    const unselected = ranges.filter(({ thread }) => thread.id !== selectedThreadId).map(({ range }) => range);
    const pendingRange =
      pendingPassage === null
        ? null
        : rangeForPassage(content, rendered.documentText, pendingPassage.startOffset, pendingPassage.endOffset);
    const names = paintHighlights([
      { name: threadsHighlightName, ranges: rangesIn(threadsHighlightName) },
      { name: overlapHighlightName, ranges: findOverlaps(unselected) },
      { name: hoveredHighlightName, ranges: rangesIn(hoveredHighlightName) },
      { name: selectedHighlightName, ranges: rangesIn(selectedHighlightName) },
      { name: pendingHighlightName, ranges: pendingRange === null ? [] : [pendingRange] },
    ]);
```

- Add `hoveredThreadId` to the effect's dependency array, in alphabetical order: `[contentRef, hoveredThreadId, layoutRevision, pendingPassage, rendered, selectedThreadId, threads, viewRef]`.
- Add this function after `threadRanges`:

```ts
function highlightOf(threadId: number, selectedThreadId: number | null, hoveredThreadId: number | null): string {
  if (threadId === selectedThreadId) {
    return selectedHighlightName;
  }
  return threadId === hoveredThreadId ? hoveredHighlightName : threadsHighlightName;
}
```

- Update the hook's doc comment's first sentence to: "Highlights the threads' passages in the rendered doc, deeper where two overlap, the hovered thread's above the rest, the selected thread's apart, and the passage of the comment the user is writing apart again".

- [ ] **Step 9: Add `useHoveredThread`**

Create `src/web/components/DocumentView/useHoveredThread.ts`:

```ts
import type { RefObject } from "react";
import { useEffect, useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { offsetAtPoint } from "../../anchoring/offsetAtPoint";
import { threadAtOffset } from "../../review/threadAtOffset";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Reports the highlighted thread under the pointer as the pointer moves over the rendered doc
 *
 * @param highlightedThreads the threads whose passages are highlighted
 * @param onHoverThread called with the thread under the pointer whenever it changes, and with null when the pointer
 *   leaves every highlight
 * @returns whether the pointer is over a highlight
 */
export function useHoveredThread(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  highlightedThreads: readonly Thread[],
  onHoverThread: (threadId: number | null) => void
): boolean {
  const [pointedThreadId, setPointedThreadId] = useState<number | null>(null);
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null) {
      return;
    }
    let frame = 0;
    let reported: number | null = null;
    const report = (threadId: number | null): void => {
      if (threadId !== reported) {
        reported = threadId;
        setPointedThreadId(threadId);
        onHoverThread(threadId);
      }
    };
    const move = ({ clientX, clientY }: PointerEvent): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = offsetAtPoint(content, rendered.documentText, clientX, clientY);
        report(offset === null ? null : (threadAtOffset(highlightedThreads, offset)?.id ?? null));
      });
    };
    const leave = (): void => {
      cancelAnimationFrame(frame);
      report(null);
    };
    content.addEventListener("pointermove", move);
    content.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      content.removeEventListener("pointermove", move);
      content.removeEventListener("pointerleave", leave);
    };
  }, [contentRef, highlightedThreads, onHoverThread, rendered]);
  return pointedThreadId !== null;
}
```

- [ ] **Step 10: Wire hover into `useDocumentOverlay`**

In `src/web/components/DocumentView/useDocumentOverlay.ts`:
- Change the React import to `import type { RefObject } from "react";` followed by `import { useContext } from "react";`.
- Add `import { HoveredThreadContext } from "../../review/HoveredThreadContext";` after the `Thread` import.
- Add `import { useHoveredThread } from "./useHoveredThread";` after the `useHoveredBlock` import.
- Add this field to `DocumentOverlay`, after `hoveredBlock`:

```ts
  /**
   * Whether the pointer is over a highlighted passage, which a click selects
   */
  isPointingAtHighlight: boolean;
```

Replace the body of `useDocumentOverlay` with:

```ts
  const { hoveredThreadId, onHoverThread } = useContext(HoveredThreadContext);
  const markers = useThreadHighlights(viewRef, contentRef, rendered, {
    hoveredThreadId,
    pendingPassage,
    selectedThreadId,
    threads: highlightedThreads,
  });
  const isPointingAtHighlight = useHoveredThread(contentRef, rendered, highlightedThreads, onHoverThread);
  const selectionComment = useSelectionComment(viewRef, contentRef, rendered, documentPath);
  const hoveredBlock = useHoveredBlock(viewRef, contentRef);
  const pendingBlock = usePendingBlock(viewRef, contentRef, rendered, pendingPassage);
  return { hoveredBlock, isPointingAtHighlight, markers, pendingBlock, selectionComment };
```

Update its doc comment to: "Follows what is drawn over the rendered doc: the threads' highlights and markers, the thread and block under the pointer, the block a comment is being written on, and the Comment button beside selected text".

- [ ] **Step 11: Move the markers into `ThreadMarkers`, with hover**

Create `src/web/components/DocumentView/ThreadMarkers.tsx`:

```tsx
import { Button } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useContext } from "react";

import { HoveredThreadContext } from "../../review/HoveredThreadContext";

import styles from "./DocumentView.module.css";
import type { ThreadMarker } from "./useThreadHighlights";

export interface ThreadMarkersProps {
  markers: ThreadMarker[];
  onSelectThread: (threadId: number) => void;
  selectedThreadId: number | null;
}

/**
 * A numbered button beside each thread's passage, which selects the thread and, while the pointer is over it, hovers it
 */
export function ThreadMarkers({ markers, onSelectThread, selectedThreadId }: ThreadMarkersProps): JSX.Element {
  const { hoveredThreadId, onHoverThread } = useContext(HoveredThreadContext);
  return (
    <>
      {markers.map(({ column, threadId, top }) => (
        <Button
          className={clsx(styles.marker, { [styles.hoveredMarker ?? ""]: threadId === hoveredThreadId })}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          onPointerEnter={() => onHoverThread(threadId)}
          onPointerLeave={() => onHoverThread(null)}
          size="sm"
          style={{ insetInlineEnd: `${column * 2}rem`, top }}
          variant={threadId === selectedThreadId ? "primary" : "secondary"}
          aria-label={`Thread #${threadId}`}
          aria-pressed={threadId === selectedThreadId}
          data-md-ignore=""
        >
          {threadId}
        </Button>
      ))}
    </>
  );
}
```

In `src/web/components/DocumentView/DocumentControls.tsx`, replace the `{markers.map(…)}` block with:

```tsx
      <ThreadMarkers markers={markers} onSelectThread={onSelectThread} selectedThreadId={selectedThreadId} />
```

Then add `import { ThreadMarkers } from "./ThreadMarkers";` after the `DocumentView.module.css` import.

- [ ] **Step 12: Show the pointer cursor over highlights**

In `src/web/components/DocumentView/DocumentView.tsx`:
- Add `import { clsx } from "clsx";` after the StylesUI import.
- Change the view's `div` to:

```tsx
      <div
        className={clsx(styles.view, { [styles.pointingAtHighlight ?? ""]: overlay.isPointingAtHighlight })}
        ref={viewRef}
      >
```

- [ ] **Step 13: Style the hovered highlight, marker and cursor**

In `src/web/components/DocumentView/DocumentView.module.css`, add after the overlap highlight rule:

```css
.content ::highlight(markdown-review-hovered) {
  background-color: color-mix(in srgb, var(--sui-color-warning) 55%, transparent);
  text-decoration-color: var(--sui-color-warning-text);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
```

Add after the `.blockButton` rule:

```css
.hoveredMarker {
  outline: 2px solid var(--sui-color-primary);
  outline-offset: 2px;
}

.pointingAtHighlight .content {
  cursor: pointer;
}
```

- [ ] **Step 14: Provide the hovered thread in `App`**

In `src/web/components/App/App.tsx`:
- Add `import { HoveredThreadProvider } from "../../review/HoveredThreadProvider";` after the `countDraftsByDocument` import.
- Wrap the `<div className={styles.columns}>…</div>` element in `<HoveredThreadProvider>…</HoveredThreadProvider>`.

- [ ] **Step 15: Run the web tests to verify they pass**

Run: `pnpm exec vitest run --project web`
Expected: PASS.

- [ ] **Step 16: Write the end-to-end test**

Add to `src/e2e/comments.e2e.ts`:

```ts
test("must emphasise a comment's passage while the user points at its card", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");

  await page.getByRole("article", { name: "Thread #1" }).hover();

  await expect.poll(() => highlightedText(page, "markdown-review-hovered")).toEqual(["cache results for 24h"]);
});
```

Run: `pnpm test:e2e src/e2e/comments.e2e.ts`
Expected: PASS in Chromium and WebKit.

- [ ] **Step 17: Check complexity, lint and typecheck**

Run: `pnpm exec fallow health src/web/components --complexity`
Expected: no function over cyclomatic 20 or cognitive 15.

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 18: Visual check**

Run the visual check, with two comments saved on the corpus. Confirm:
- Pointing at a highlight deepens it, outlines its marker, shades its card and shows a pointer cursor.
- Pointing at a card deepens its highlight.
- Moving away undoes each.

- [ ] **Step 19: Commit**

```bash
git add src/web/review/HoveredThreadContext.ts src/web/review/HoveredThreadProvider.tsx src/web/components src/e2e/comments.e2e.ts
git commit -m "Link a highlight and its card while the user points at either

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Give headings a link that puts the section in the address and copies it

**Files:**
- Create: `src/web/rendering/addHeadingLinks.ts`
- Create: `src/web/components/DocumentView/copyHeadingLink.ts`
- Create: `src/e2e/rendering.e2e.ts`
- Modify: `src/web/rendering/renderDocument.ts`
- Modify: `src/web/components/DocumentView/useDocumentClicks.ts`
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Test: `src/web/rendering/renderDocument.test.ts`
- Test: `src/web/components/DocumentView/DocumentView.test.tsx`

**Interfaces:**
- Produces:
  - `addHeadingLinks(container: ParentNode): void`. Each heading with an id gets an `aria-label` of its text and, at its end, `<a href="#<id>" aria-label="Link to <text>" data-heading-link data-md-ignore>#</a>`.
  - `copyHeadingLink(link: Element): void`

- [ ] **Step 1: Write the failing `renderDocument` tests**

Add to `src/web/rendering/renderDocument.test.ts`, after the heading ids test:

```ts
  test("must give each heading a link to itself that the walk of its text skips", async () => {
    const page = await renderPage("# Retry Policy\n\n## Notes\n");

    const links = [...page.querySelectorAll("h1 > a, h2 > a")].map((link) => [
      link.getAttribute("href"),
      link.getAttribute("aria-label"),
      link.hasAttribute("data-md-ignore"),
    ]);
    expect(links).toEqual([
      ["#retry-policy", "Link to Retry Policy", true],
      ["#notes", "Link to Notes", true],
    ]);
  });

  test("must name a heading by its text alone when it has a link", async () => {
    const page = await renderPage("# Retry `Policy`\n");

    expect(page.querySelector("h1")?.getAttribute("aria-label")).toBe("Retry Policy");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/rendering/renderDocument.test.ts -t "link to itself|text alone"`
Expected: FAIL; no heading has a link.

- [ ] **Step 3: Add `addHeadingLinks` and call it**

Create `src/web/rendering/addHeadingLinks.ts`:

```ts
/**
 * Gives each of a rendered doc's headings a link to itself, at its end, and names the heading by its text alone so the
 * link does not join its name
 *
 * @param container the rendered doc, whose headings already have their ids
 */
export function addHeadingLinks(container: ParentNode): void {
  for (const heading of container.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")) {
    const text = heading.textContent;
    const link = heading.ownerDocument.createElement("a");
    link.textContent = "#";
    link.setAttribute("aria-label", `Link to ${text}`);
    link.setAttribute("data-heading-link", "");
    link.setAttribute("data-md-ignore", "");
    link.setAttribute("href", `#${heading.id}`);
    heading.setAttribute("aria-label", text);
    heading.append(link);
  }
}
```

In `src/web/rendering/renderDocument.ts`:
- Add `import { addHeadingLinks } from "./addHeadingLinks";` before the `addHeadingIds` import.
- Add `addHeadingLinks(template.content);` after `pointLinksAtReview(template.content, documentPath);`.
- In the doc comment, change "with fenced code highlighted, headings given GitHub's ids" to "with fenced code highlighted, headings given GitHub's ids and a link to themselves".

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm exec vitest run --project web src/web/rendering`
Expected: PASS, including the conformance test.

- [ ] **Step 5: Write the failing `DocumentView` tests**

Add to `src/web/components/DocumentView/DocumentView.test.tsx`, after "must show a linked doc in the page when the user follows a link to it":

```ts
  test("must copy the page's address, holding the heading, when the user clicks a heading's link", async () => {
    onTestFinished(() => history.replaceState(null, "", "/"));
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(within(elements.article()).getByRole("link", { name: "Link to Goals" }));

    expect(location.hash).toBe("#goals");
    expect(await navigator.clipboard.readText()).toBe(location.href);
  });

  test("must still put the heading in the address when the browser refuses the copy", async () => {
    onTestFinished(() => history.replaceState(null, "", "/"));
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("Denied", "NotAllowedError"));

    await user.click(within(elements.article()).getByRole("link", { name: "Link to Goals" }));

    expect(location.hash).toBe("#goals");
  });
```

- [ ] **Step 6: Run them to verify the first fails**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView/DocumentView.test.tsx -t "heading's link|refuses"`
Expected: the first test FAILS, because the clipboard is empty. The second already passes, since the address changes either way.

- [ ] **Step 7: Copy the address after a heading link is clicked**

Create `src/web/components/DocumentView/copyHeadingLink.ts`:

```ts
const copiedDuration = 1500;

/**
 * Copies the page's address, which a heading link has just set to the heading, and marks the link as copied for a
 * moment
 *
 * @param link the heading link the user clicked
 */
export function copyHeadingLink(link: Element): void {
  navigator.clipboard.writeText(location.href).then(
    () => {
      link.setAttribute("data-copied", "");
      setTimeout(() => link.removeAttribute("data-copied"), copiedDuration);
    },
    // A refused copy still leaves the heading in the page's address, where the user can copy it
    () => {}
  );
}
```

In `src/web/components/DocumentView/useDocumentClicks.ts`:
- Add `import { copyHeadingLink } from "./copyHeadingLink";` before the `RenderedDocument` type import.
- In the click handler, change the link branch to:

```ts
      if (link !== null) {
        followLink(event, content, link.getAttribute("href") ?? "", onNavigate);
        if (link.hasAttribute("data-heading-link")) {
          copyHeadingLink(link);
        }
        return;
      }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project web`
Expected: PASS.

If a test elsewhere finds a heading with `getByText` and now fails, because the heading's text has gained "#", change it to find the heading with `getByRole("heading", { name })`.

- [ ] **Step 9: Style the heading link**

Add to `src/web/components/DocumentView/DocumentView.module.css`:

```css
.content [data-heading-link] {
  color: var(--sui-color-text-muted);
  margin-inline-start: var(--sui-space-2);
  opacity: 0;
  text-decoration-line: none;
  user-select: none;
}

.content :is(h1, h2, h3, h4, h5, h6):hover > [data-heading-link],
.content [data-heading-link]:focus-visible,
.content [data-heading-link][data-copied] {
  opacity: 1;
}

.content [data-heading-link][data-copied]::after {
  color: var(--sui-color-success-text);
  content: " ✓";
}
```

- [ ] **Step 10: Write the end-to-end test**

Create `src/e2e/rendering.e2e.ts`:

```ts
import { expect } from "@playwright/test";

import { plan, test } from "./testing/reviewTest";

test("must put a heading's section in the page address when the user clicks the heading's link", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", `${plan}\n## Goals\n\nShip it.\n`);
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });

  await article.getByRole("heading", { name: "Goals" }).hover();
  await article.getByRole("link", { name: "Link to Goals" }).click();

  await expect(page).toHaveURL(/#goals$/);
});
```

Run: `pnpm test:e2e src/e2e/rendering.e2e.ts`
Expected: PASS in Chromium and WebKit, with no console errors.

- [ ] **Step 11: Lint, typecheck and visual check**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

Run the visual check. Confirm:
- Pointing at a heading shows a muted "#" after it.
- Clicking it puts the heading in the address, copies the address, and shows a green tick for about a second and a half.
- Selecting a heading's text doesn't select the "#".

- [ ] **Step 12: Commit**

```bash
git add src/web/rendering src/web/components/DocumentView src/e2e/rendering.e2e.ts
git commit -m "Give headings a link that puts the section in the address and copies it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Redraw Mermaid diagrams when the system switches between light and dark mode

**Files:**
- Modify: `src/web/rendering/renderMermaidDiagrams.ts`
- Modify: `src/web/components/DocumentView/useMermaidDiagrams.ts`
- Test: `src/web/rendering/renderMermaidDiagrams.test.ts`

**Interfaces:**
- Produces:
  - `hasMermaidDiagrams(container: Element): boolean`
  - `renderMermaidDiagrams(container: Element): Promise<void>`, which now also redraws diagrams it has drawn, from the definition it keeps in `data-mermaid-definition` on the block wrapper

- [ ] **Step 1: Write the failing tests**

In `src/web/rendering/renderMermaidDiagrams.test.ts`, change the import to `import { hasMermaidDiagrams, renderMermaidDiagrams } from "./renderMermaidDiagrams";`, and add these tests at the end of the `describe`:

```ts
  test("must draw a drawn diagram again from its definition when the diagrams are drawn again", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });
    await renderMermaidDiagrams(page);
    mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow in dark mode"><text>A</text></svg>' });

    await renderMermaidDiagrams(page);

    expect(page.querySelector('[data-md-block="0"] > svg')?.getAttribute("aria-label")).toBe("Request flow in dark mode");
    expect(mermaid.render).toHaveBeenLastCalledWith("mermaid-diagram-0", "graph TD\n  A-->B");
  });

  test.each([
    { condition: "has a Mermaid fence", expected: true, source: diagramSource },
    { condition: "has no Mermaid fence", expected: false, source: "```ts\nconst a = 1;\n```\n" },
  ])("must say whether the doc has diagrams when it $condition", async ({ expected, source }) => {
    const page = await renderPage(source);

    expect(hasMermaidDiagrams(page)).toBe(expected);
  });

  test("must still say the doc has diagrams once they are drawn", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });

    await renderMermaidDiagrams(page);

    expect(hasMermaidDiagrams(page)).toBe(true);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/rendering/renderMermaidDiagrams.test.ts`
Expected: FAIL, because `hasMermaidDiagrams` is not exported.

- [ ] **Step 3: Keep definitions and redraw from them**

Replace `src/web/rendering/renderMermaidDiagrams.ts` with:

```ts
const definitionAttribute = "data-mermaid-definition";

interface Diagram {
  definition: string;

  /**
   * What a new drawing replaces: the diagram's source, or its last drawing
   */
  drawing: Element;
}

/**
 * Tells whether a rendered doc has Mermaid diagrams, drawn or not
 */
export function hasMermaidDiagrams(container: Element): boolean {
  return findDiagrams(container).length > 0;
}

/**
 * Draws a rendered doc's Mermaid diagrams in the colours of the current light or dark mode, in place of their source
 * or their last drawing, loading Mermaid only when the doc has a diagram
 *
 * @param container the rendered doc
 * @returns once every diagram is drawn; a diagram Mermaid cannot read keeps showing what it showed
 */
export async function renderMermaidDiagrams(container: Element): Promise<void> {
  const diagrams = findDiagrams(container);
  if (diagrams.length === 0) {
    return;
  }
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    securityLevel: "strict",
    startOnLoad: false,
    theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
  });
  for (const [index, { definition, drawing }] of diagrams.entries()) {
    if ((await mermaid.parse(definition, { suppressErrors: true })) === false) {
      continue;
    }
    const { svg } = await mermaid.render(`mermaid-diagram-${index}`, definition);
    const diagram = document.createElement("template");
    diagram.innerHTML = svg;
    drawing.parentElement?.setAttribute(definitionAttribute, definition);
    drawing.replaceWith(diagram.content);
  }
}

function findDiagrams(container: Element): Diagram[] {
  const sources = [...container.querySelectorAll("pre > code.language-mermaid")].flatMap((code): Diagram[] =>
    code.parentElement === null ? [] : [{ definition: code.textContent, drawing: code.parentElement }]
  );
  const drawn = [...container.querySelectorAll(`[${definitionAttribute}] > svg`)].flatMap((svg): Diagram[] => {
    const definition = svg.parentElement?.getAttribute(definitionAttribute) ?? null;
    return definition === null ? [] : [{ definition, drawing: svg }];
  });
  return [...sources, ...drawn];
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm exec vitest run --project web src/web/rendering/renderMermaidDiagrams.test.ts`
Expected: PASS.

- [ ] **Step 5: Redraw when the colour scheme changes**

Replace `src/web/components/DocumentView/useMermaidDiagrams.ts` with:

```ts
import type { RefObject } from "react";
import { useEffect } from "react";

import { hasMermaidDiagrams, renderMermaidDiagrams } from "../../rendering/renderMermaidDiagrams";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Draws the Mermaid diagrams of each new rendering of the doc once it is in the page, and draws them again in the new
 * colours when the system switches between light and dark mode
 */
export function useMermaidDiagrams(contentRef: RefObject<HTMLElement | null>, rendered: RenderedDocument | null): void {
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null || !hasMermaidDiagrams(content)) {
      return;
    }
    const draw = (): void => {
      renderMermaidDiagrams(content).catch((failure: unknown) => reportError(failure));
    };
    draw();
    const darkMode = matchMedia("(prefers-color-scheme: dark)");
    darkMode.addEventListener("change", draw);
    return () => darkMode.removeEventListener("change", draw);
  }, [contentRef, rendered]);
}
```

- [ ] **Step 6: Run the web tests, lint and typecheck**

Run: `pnpm exec vitest run --project web && pnpm lint && pnpm typecheck`
Expected: PASS. Tests of docs without diagrams never reach `matchMedia`, which jsdom lacks.

- [ ] **Step 7: Visual check**

Run the visual check. With the corpus open, switch the system between light and dark mode, and confirm the Mermaid diagram redraws in the matching colours without reloading the page.

- [ ] **Step 8: Commit**

```bash
git add src/web/rendering/renderMermaidDiagrams.ts src/web/rendering/renderMermaidDiagrams.test.ts src/web/components/DocumentView/useMermaidDiagrams.ts
git commit -m "Redraw Mermaid diagrams when the system switches between light and dark mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Re-anchor stored threads when the canonical-text rules change

**Files:**
- Create: `src/shared/markdown/anchoringVersion.ts`
- Modify: `src/server/store/hashSource.ts`
- Modify: `AGENTS.md`
- Test: `src/server/store/hashSource.test.ts`
- Test: `src/server/store/ReviewStore.test.ts`

**Interfaces:**
- Produces: `anchoringVersion = 2`. `hashSource(source)` returns the SHA-256 of `"2\n" + source`, as lowercase hex.

- [ ] **Step 1: Write the failing tests**

In `src/server/store/hashSource.test.ts`, replace the test with:

```ts
  test("must return the SHA-256 of the anchoring version and the source as lowercase hex when given a source", () => {
    expect(hashSource("abc")).toBe("29d02cb1417999ed61b6b17b7ae214987dd6657439f2c35b36528e01830e6aa6");
  });
```

In `src/server/store/ReviewStore.test.ts`:
- Add `import { createHash } from "node:crypto";` as the first import.
- Change the `reviewBuilders` import to `import { buildPassageAnchor, buildThread } from "../../shared/review/testing/reviewBuilders";`.
- Add this test after "must report the moved lines and save the new hash when the doc was edited while nothing was reading it":

```ts
  test("must re-anchor threads stored under older canonical-text rules when their doc has not changed", async () => {
    const { root, store } = await setUpLoadedTest();
    const anchoredUnderOldRules = buildPassageAnchor({
      anchoredText: "three times",
      endLine: 3,
      endOffset: 13,
      prefix: "",
      quote: "three times",
      startLine: 3,
      startOffset: 2,
      suffix: "",
    });
    await writeJson(path.join(root, ".markdown-review", "documents", "docs", "plan.md.json"), {
      document: "docs/plan.md",
      sourceHash: createHash("sha256").update(plan, "utf8").digest("hex"),
      threads: [buildThread({ anchor: anchoredUnderOldRules, id: 1 })],
      version: 1,
    });

    const snapshot = await store.readThreads("docs/plan.md");

    expect(snapshot.threads[0]?.anchor).toMatchObject({
      endLine: 5,
      startLine: 5,
      startOffset: createDocumentText(plan).text.indexOf("three times"),
    });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run --project node src/server/store/hashSource.test.ts src/server/store/ReviewStore.test.ts`
Expected: FAIL. The hash is the plain SHA-256, and the thread keeps its stale lines because the hash matches.

- [ ] **Step 3: Add the version and hash it with the source**

Create `src/shared/markdown/anchoringVersion.ts`:

```ts
/**
 * The version of the rules that turn a doc's source into its canonical text; it goes up whenever the same source would
 * give different canonical text, so that threads anchored under the old rules are re-anchored
 */
export const anchoringVersion = 2;
```

Replace `src/server/store/hashSource.ts` with:

```ts
import { createHash } from "node:crypto";

import { anchoringVersion } from "../../shared/markdown/anchoringVersion";

/**
 * Fingerprints a doc's source under the current canonical-text rules, so the store can tell when anchors were computed
 * against an older version of either
 *
 * @param source the markdown source
 * @returns the SHA-256 of the anchoring version, a newline and the source, as 64 lowercase hex digits
 */
export function hashSource(source: string): string {
  return createHash("sha256").update(`${anchoringVersion}\n${source}`, "utf8").digest("hex");
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm exec vitest run --project node`
Expected: PASS.

- [ ] **Step 5: Tell agents when to raise the version**

In `AGENTS.md`, at the end of the paragraph under "## Anchoring", add:

```markdown
A change that gives the same source different canonical text, such as a new markdown plugin, must also raise `anchoringVersion` in `src/shared/markdown/anchoringVersion.ts`, so threads stored under the old text are re-anchored.
```

- [ ] **Step 6: Lint, typecheck and run the integration tests**

Run: `pnpm lint && pnpm typecheck && pnpm exec vitest run --project integration`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/markdown/anchoringVersion.ts src/server/store/hashSource.ts src/server/store/hashSource.test.ts src/server/store/ReviewStore.test.ts AGENTS.md
git commit -m "Re-anchor stored threads when the canonical-text rules change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Render GitHub alerts as titled callouts

**Files:**
- Modify: `package.json` (through `pnpm add`)
- Modify: `src/shared/markdown/createMarkdownIt.ts`
- Modify: `src/web/rendering/testing/conformanceCorpus.md`
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Test: `src/shared/markdown/parseBlocks.test.ts`
- Test: `src/web/rendering/renderDocument.test.ts`

**Interfaces:**
- Consumes: `anchoringVersion` (Task 8), which stays 2.
- Produces: alerts rendered as `<div class="markdown-alert markdown-alert-<name>">`, holding `<p class="markdown-alert-title" data-md-ignore="">Note</p>` and then the alert's blocks.

- [ ] **Step 1: Add the plugin**

Run: `GITHUB_TOKEN=$(gh auth token) pnpm add @mdit/plugin-alert && pnpm format`
Expected: `@mdit/plugin-alert` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

In `src/shared/markdown/parseBlocks.test.ts`, add these cases to the `test.each` table, after "a blockquote holds two paragraphs":

```ts
    {
      condition: "a GitHub alert holds a paragraph",
      source: "> [!NOTE]\n> Cache for **24h**.\n",
      expected: [oneLineBlock(2, "Cache for 24h.")],
    },
    {
      condition: "an alert's marker has nothing after it",
      source: "> [!NOTE]\n",
      expected: [oneLineBlock(1, "[!NOTE]")],
    },
```

In `src/web/rendering/renderDocument.test.ts`, add:

```ts
  test.each([
    { marker: "NOTE", title: "Note" },
    { marker: "tip", title: "Tip" },
    { marker: "Important", title: "Important" },
    { marker: "WARNING", title: "Warning" },
    { marker: "CAUTION", title: "Caution" },
  ])("must title a $marker alert $title, apart from the walk of the doc's text, when the doc has one", async ({ marker, title }) => {
    const page = await renderPage(`> [!${marker}]\n> Read this.\n`);

    const alertTitle = page.querySelector(".markdown-alert > .markdown-alert-title");
    expect(alertTitle?.textContent).toBe(title);
    expect(alertTitle?.hasAttribute("data-md-ignore")).toBe(true);
    expect(page.querySelector('[data-md-block="0"]')?.textContent).toBe("Read this.");
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec vitest run --project node src/shared/markdown/parseBlocks.test.ts`
Expected: FAIL. The alert's text is "[!NOTE]\nCache for 24h." on line 1.

Run: `pnpm exec vitest run --project web src/web/rendering/renderDocument.test.ts -t "alert"`
Expected: FAIL; there is no `.markdown-alert`.

- [ ] **Step 4: Use the plugin with our own title**

In `src/shared/markdown/createMarkdownIt.ts`:
- Add `import { alert } from "@mdit/plugin-alert";` as the first import.
- Change the instance line to:

```ts
  const markdown = new markdownIt({ html: true }).use(tasklist).use(alert, { titleRenderer: renderAlertTitle });
```

Add, after `renderHtmlBlock`:

```ts
// The plugin accepts only these names, and gives each alert's title token its name in lower case as its markup
const alertTitles: Partial<Record<string, string>> = {
  caution: "Caution",
  important: "Important",
  note: "Note",
  tip: "Tip",
  warning: "Warning",
};

const renderAlertTitle: RendererRule = (tokens, index) => {
  const name = tokenAt(tokens, index).markup;
  return `<p class="markdown-alert-title" data-md-ignore="">${alertTitles[name] ?? name}</p>\n`;
};
```

- [ ] **Step 5: Add alerts to the conformance corpus**

In `src/web/rendering/testing/conformanceCorpus.md`, after the blockquote ending "> A second paragraph in the quote.", add:

```markdown

> [!NOTE]
> A note with **strong** text.

> [!TIP]
> A tip.

> [!IMPORTANT]
> Something important
> over two lines.

> [!WARNING]
> A warning.

> [!CAUTION]
> A caution.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project node src/shared/markdown && pnpm exec vitest run --project web src/web/rendering`
Expected: PASS, including the conformance test with the new alerts.

- [ ] **Step 7: Style the callouts**

Add to `src/web/components/DocumentView/DocumentView.module.css`:

```css
.content :global(.markdown-alert) {
  background-color: var(--alert-subtle);
  border-inline-start: 3px solid var(--alert-color);
  border-radius: var(--sui-radius-md);
  padding: var(--sui-space-3) var(--sui-space-4);
}

.content :global(.markdown-alert):not(:first-child) {
  margin-block-start: var(--sui-prose-flow);
}

.content :global(.markdown-alert-title) {
  align-items: center;
  color: var(--alert-text);
  display: flex;
  font-weight: var(--sui-font-weight-bold);
  gap: var(--sui-space-2);
  user-select: none;
}

.content :global(.markdown-alert-title)::before {
  background-color: currentColor;
  block-size: 1em;
  content: "";
  inline-size: 1em;
  mask: var(--alert-icon) center / contain no-repeat;
}

.content :global(.markdown-alert-title) + * {
  margin-block-start: var(--sui-space-1);
}

.content :global(.markdown-alert-note) {
  --alert-color: var(--sui-color-info);
  --alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='8' cy='8' r='6'/%3E%3Cpath d='M8 7.5v3.5M8 5h.01'/%3E%3C/svg%3E");
  --alert-subtle: var(--sui-color-info-subtle);
  --alert-text: var(--sui-color-info-text);
}

.content :global(.markdown-alert-tip) {
  --alert-color: var(--sui-color-success);
  --alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 12h4M6.5 14h3M8 2a4 4 0 0 0-2.5 7.1c.4.3.5.8.5 1.3V11h4v-.6c0-.5.1-1 .5-1.3A4 4 0 0 0 8 2z'/%3E%3C/svg%3E");
  --alert-subtle: var(--sui-color-success-subtle);
  --alert-text: var(--sui-color-success-text);
}

.content :global(.markdown-alert-important) {
  --alert-color: var(--sui-color-primary);
  --alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z'/%3E%3Cpath d='M8 5.5v2.5M8 9.5h.01'/%3E%3C/svg%3E");
  --alert-subtle: var(--sui-color-primary-subtle);
  --alert-text: var(--sui-color-primary);
}

.content :global(.markdown-alert-warning) {
  --alert-color: var(--sui-color-warning);
  --alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 2.5 14 13H2z'/%3E%3Cpath d='M8 6.5v3M8 11.5h.01'/%3E%3C/svg%3E");
  --alert-subtle: var(--sui-color-warning-subtle);
  --alert-text: var(--sui-color-warning-text);
}

.content :global(.markdown-alert-caution) {
  --alert-color: var(--sui-color-danger);
  --alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.5 2h5L14 5.5v5L10.5 14h-5L2 10.5v-5z'/%3E%3Cpath d='M8 5v3.5M8 11h.01'/%3E%3C/svg%3E");
  --alert-subtle: var(--sui-color-danger-subtle);
  --alert-text: var(--sui-color-danger-text);
}
```

- [ ] **Step 8: Lint, typecheck and visual check**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

Run the visual check. Confirm each of the five alerts is a tinted callout with a coloured start border and an icon and title in the matching colour, in both modes. Confirm the title can't be selected, and that + and selection comments on an alert's paragraph work.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/markdown src/web/rendering src/web/components/DocumentView/DocumentView.module.css
git commit -m "Render GitHub alerts as titled callouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Show YAML frontmatter as a Properties panel that takes whole-block comments

**Files:**
- Create: `src/shared/markdown/frontMatterRule.ts`
- Create: `src/web/rendering/readProperty.ts`
- Create: `src/web/rendering/renderFrontMatter.ts`
- Create: `src/web/rendering/renderFrontMatter.test.ts`
- Modify: `package.json` (through `pnpm add -D`)
- Modify: `src/shared/markdown/createMarkdownIt.ts`
- Modify: `src/shared/markdown/LeafBlock.ts`
- Modify: `src/shared/markdown/findLeafBlocks.ts`
- Modify: `src/shared/markdown/parseBlocks.ts`
- Modify: `src/shared/markdown/MarkdownBlock.ts`
- Modify: `src/web/rendering/renderDocument.ts`
- Modify: `src/web/rendering/testing/conformanceCorpus.md`
- Modify: `src/web/components/DocumentView/DocumentView.module.css`
- Test: `src/shared/markdown/parseBlocks.test.ts`
- Test: `src/e2e/rendering.e2e.ts`

**Interfaces:**
- Consumes:
  - `anchoringVersion` (Task 8), which stays 2
  - `data-language` and the code frame (Tasks 1 and 3)
  - the task-list checkbox style (Task 1)
  - `rendering.e2e.ts` (Task 6)
- Produces:
  - `frontMatterRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean`, emitting a `front_matter` token
  - `LeafBlockKind` gains `"frontMatter"`
  - `readProperty(key: string, value: unknown): Property`
  - `renderFrontMatter(container: ParentNode): Promise<void>`

- [ ] **Step 1: Add `yaml`**

Run: `GITHUB_TOKEN=$(gh auth token) pnpm add -D yaml && pnpm format`
Expected: `yaml` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Write the failing `parseBlocks` tests**

In `src/shared/markdown/parseBlocks.test.ts`, add these cases to the `test.each` table, before "the source has Windows line endings":

```ts
    {
      condition: "the doc starts with frontmatter",
      source: "---\ntitle: Plan\ntags: [a, b]\n---\n\n# Plan\n",
      expected: [
        {
          endLine: 4,
          exactLines: true,
          lineOffsets: [
            { line: 2, offset: 0 },
            { line: 3, offset: 12 },
          ],
          startLine: 1,
          text: "title: Plan\ntags: [a, b]",
          wholeBlockOnly: true,
        },
        oneLineBlock(6, "Plan"),
      ],
    },
    {
      condition: "the frontmatter has Windows line endings",
      source: "---\r\ntitle: Plan\r\n---\r\n\r\n# Plan\r\n",
      expected: [
        {
          endLine: 3,
          exactLines: true,
          lineOffsets: [{ line: 2, offset: 0 }],
          startLine: 1,
          text: "title: Plan",
          wholeBlockOnly: true,
        },
        oneLineBlock(5, "Plan"),
      ],
    },
    {
      condition: "the frontmatter is empty, so it has no visible text",
      source: "---\n---\n# Plan\n",
      expected: [
        {
          endLine: 2,
          exactLines: true,
          lineOffsets: [
            { line: 1, offset: 0 },
            { line: 2, offset: 4 },
          ],
          startLine: 1,
          text: "---\n---",
          wholeBlockOnly: true,
        },
        oneLineBlock(3, "Plan"),
      ],
    },
    {
      condition: "the doc starts with a horizontal rule and has another one later",
      source: "---\n\n# Plan\n\n---\n",
      expected: [oneLineBlock(3, "Plan")],
    },
    {
      condition: "the doc's first --- is never closed",
      source: "---\ntitle: Plan\n",
      expected: [oneLineBlock(2, "title: Plan")],
    },
    {
      condition: "a blockquote at the start of the doc holds --- lines",
      source: "> ---\n> title: Plan\n> ---\n",
      expected: [{ ...oneLineBlock(2, "title: Plan"), endLine: 3 }],
    },
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec vitest run --project node src/shared/markdown/parseBlocks.test.ts`
Expected: FAIL for the first three cases, which parse as a horizontal rule and a setext heading. The last three already pass.

- [ ] **Step 4: Add the block rule**

Create `src/shared/markdown/frontMatterRule.ts`:

```ts
import type { StateBlock } from "markdown-it";

const openingFence = "---";

const closingFences = new Set(["---", "..."]);

/**
 * Recognises YAML frontmatter: a `---` line that starts the doc and is followed by a line that is not blank, through the
 * next `---` or `...` line
 *
 * @returns whether the doc starts with frontmatter; when it does and `silent` is false, the rule adds a `front_matter`
 *   token holding the lines between the fences
 */
export function frontMatterRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (startLine !== 0 || state.parentType !== "root" || lineAt(state, 0).trimEnd() !== openingFence) {
    return false;
  }
  if (state.isEmpty(1)) {
    return false;
  }
  const closingLine = findClosingLine(state, endLine);
  if (closingLine === null) {
    return false;
  }
  if (!silent) {
    const token = state.push("front_matter", "", 0);
    token.block = true;
    token.content = state.getLines(1, closingLine, 0, true);
    token.map = [0, closingLine + 1];
    token.markup = openingFence;
    state.line = closingLine + 1;
  }
  return true;
}

function findClosingLine(state: StateBlock, endLine: number): number | null {
  for (let line = 1; line < endLine; line++) {
    if (closingFences.has(lineAt(state, line).trimEnd())) {
      return line;
    }
  }
  return null;
}

function lineAt(state: StateBlock, line: number): string {
  return state.getLines(line, line + 1, 0, false);
}
```

In `src/shared/markdown/createMarkdownIt.ts`:
- Add `import { frontMatterRule } from "./frontMatterRule";` after the `fenceLanguage` import.
- Inside `createMarkdownIt`, after `renderCodeBlock`, add:

```ts
  // The browser replaces this code with a Properties panel; the server only needs the block
  const renderFrontMatterBlock: RendererRule = (tokens, index, _options, _environment, renderer) => {
    const token = tokenAt(tokens, index);
    const yaml = escapeHtml(withoutFinalNewline(token.content));
    return `<div${renderer.renderAttrs(token)} data-front-matter=""><pre><code>${yaml}</code></pre></div>\n`;
  };
```

- Register the rule and its renderer next to the other rules:

```ts
  markdown.block.ruler.before("table", "front_matter", frontMatterRule);
  markdown.renderer.rules.front_matter = renderFrontMatterBlock;
```

- [ ] **Step 5: Make frontmatter a leaf block**

In `src/shared/markdown/LeafBlock.ts`, change the kind to:

```ts
export type LeafBlockKind = "inline" | "tableRow" | "fence" | "codeBlock" | "htmlBlock" | "frontMatter";
```

In `src/shared/markdown/findLeafBlocks.ts`, add `front_matter: "frontMatter",` to `leafBlockKinds`, after `fence`.

In `src/shared/markdown/parseBlocks.ts`, add this case to `toMarkdownBlock`, after the `fence` case:

```ts
    case "frontMatter": {
      const text = withoutFinalNewline(token.content);
      const lineOffsets = codeLineOffsets(text, startLine + 1, endLine);
      return { endLine, exactLines: true, lineOffsets, startLine, text, wholeBlockOnly: true };
    }
```

In `src/shared/markdown/MarkdownBlock.ts`, change the `wholeBlockOnly` doc comment to:

```ts
  /**
   * True for blocks that take whole-block comments only: HTML blocks, Mermaid fences, frontmatter and blocks with no
   * visible text, whose text is their source, and paragraphs or headings holding inline HTML the browser may restructure
   */
```

- [ ] **Step 6: Run the `parseBlocks` tests to verify they pass**

Run: `pnpm exec vitest run --project node src/shared/markdown`
Expected: PASS.

- [ ] **Step 7: Write the failing `renderFrontMatter` tests**

Create `src/web/rendering/renderFrontMatter.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { renderDocument } from "./renderDocument";

const frontMatter = [
  "---",
  "title: Payment retries",
  "draft: true",
  "version: 3",
  "created: 2026-10-01",
  "spec: https://example.com/spec",
  "tags: [payments, reliability]",
  "reviewers:",
  "  - alice",
  "  - bob",
  "owner:",
  "  name: Matt",
  "notes:",
  "---",
  "",
  "# Plan",
  "",
].join("\n");

describe("renderFrontMatter", () => {
  test("must show the doc's frontmatter as an open Properties panel in the frontmatter's block", async () => {
    const page = await renderPage(frontMatter);

    const block = page.querySelector('[data-md-block="0"]');
    expect(block?.getAttribute("data-md-start")).toBe("1");
    expect(block?.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(block?.querySelector("summary")?.textContent).toBe("Properties");
    expect(block?.querySelector("pre")).toBeNull();
  });

  test("must list each key in order, with the kind of value it has", async () => {
    const page = await renderPage(frontMatter);

    expect(elements.keys(page)).toEqual([
      ["text", "title"],
      ["checkbox", "draft"],
      ["number", "version"],
      ["date", "created"],
      ["link", "spec"],
      ["tags", "tags"],
      ["list", "reviewers"],
      ["nested", "owner"],
      ["empty", "notes"],
    ]);
  });

  test.each([
    { expected: "Payment retries", key: "title" },
    { expected: "3", key: "version" },
    { expected: "2026-10-01", key: "created" },
    { expected: "name: Matt", key: "owner" },
    { expected: "Empty", key: "notes" },
  ])("must show the $key value as $expected", async ({ expected, key }) => {
    const page = await renderPage(frontMatter);

    expect(elements.value(page, key)?.textContent).toBe(expected);
  });

  test("must show lists as chips, and tags as tag chips", async () => {
    const page = await renderPage(frontMatter);

    expect(elements.chips(page, "tags")).toEqual([
      ["payments", true],
      ["reliability", true],
    ]);
    expect(elements.chips(page, "reviewers")).toEqual([
      ["alice", false],
      ["bob", false],
    ]);
  });

  test("must show a true value as a ticked checkbox that cannot be changed", async () => {
    const page = await renderPage(frontMatter);

    const checkbox = elements.value(page, "draft")?.querySelector("input");
    expect(checkbox?.getAttribute("type")).toBe("checkbox");
    expect(checkbox?.hasAttribute("checked")).toBe(true);
    expect(checkbox?.hasAttribute("disabled")).toBe(true);
  });

  test("must show a web address as a link that opens in a new tab", async () => {
    const page = await renderPage(frontMatter);

    const link = elements.value(page, "spec")?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/spec");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  test("must show markup in a value as text", async () => {
    const page = await renderPage('---\ntitle: "<img src=x onerror=alert(1)>"\n---\n');

    expect(elements.value(page, "title")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(page.querySelector("img")).toBeNull();
  });

  test.each([
    { condition: "has a YAML error", yaml: "title: [unclosed" },
    { condition: "is a list rather than a mapping", yaml: "- a\n- b" },
  ])("must keep the frontmatter as code headed frontmatter when it $condition", async ({ yaml }) => {
    const page = await renderPage(`---\n${yaml}\n---\n`);

    const block = page.querySelector('[data-md-block="0"]');
    expect(block?.getAttribute("data-language")).toBe("frontmatter");
    expect(block?.querySelector("pre")?.textContent).toBe(yaml);
  });

  test("must say there are no properties when the frontmatter is empty", async () => {
    const page = await renderPage("---\n---\n\n# Plan\n");

    expect(page.querySelector('[data-md-block="0"] details')?.textContent).toBe("PropertiesNo properties");
  });
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plan.md");
  return page;
}

const elements = {
  chips: (page: HTMLElement, key: string): [string, boolean][] =>
    [...(elements.value(page, key)?.querySelectorAll("[data-chip]") ?? [])].map((chip) => [
      chip.textContent,
      chip.hasAttribute("data-tag"),
    ]),
  keys: (page: HTMLElement): string[][] =>
    [...page.querySelectorAll("dt")].map((term) => [term.getAttribute("data-type") ?? "", term.textContent]),
  value: (page: HTMLElement, key: string): Element | null =>
    [...page.querySelectorAll("dt")].find((term) => term.textContent === key)?.nextElementSibling ?? null,
};
```

- [ ] **Step 8: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/rendering/renderFrontMatter.test.ts`
Expected: FAIL; the block still holds the YAML as code.

- [ ] **Step 9: Add `readProperty`**

Create `src/web/rendering/readProperty.ts`:

```ts
/**
 * A frontmatter value, read for display
 */
export type Property =
  | { isTicked: boolean; kind: "checkbox" }
  | { kind: "date" | "link" | "number" | "text"; text: string }
  | { kind: "empty" }
  | { items: string[]; kind: "list" | "tags" }
  | { kind: "nested"; value: unknown };

const isoDate = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Reads a frontmatter value for display
 *
 * @param key the value's key; a list under `tags` is read as tags
 * @param value the value as YAML parsed it
 * @returns the value, with the kind that decides how it is shown and which icon its key gets
 */
export function readProperty(key: string, value: unknown): Property {
  if (Array.isArray(value)) {
    return readList(key, value);
  }
  switch (typeof value) {
    case "boolean":
      return { isTicked: value, kind: "checkbox" };
    case "number":
      return { kind: "number", text: String(value) };
    case "string":
      return { kind: textKind(value), text: value };
    default:
      return value === null || value === undefined ? { kind: "empty" } : { kind: "nested", value };
  }
}

function readList(key: string, items: unknown[]): Property {
  if (!items.every(isScalar)) {
    return { kind: "nested", value: items };
  }
  return { items: items.map(String), kind: key === "tags" ? "tags" : "list" };
}

function isScalar(value: unknown): value is boolean | number | string {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}

function textKind(text: string): "date" | "link" | "text" {
  if (URL.canParse(text) && ["http:", "https:"].includes(new URL(text).protocol)) {
    return "link";
  }
  return isoDate.test(text) ? "date" : "text";
}
```

- [ ] **Step 10: Add `renderFrontMatter` and call it**

Create `src/web/rendering/renderFrontMatter.ts`:

```ts
import type { Property } from "./readProperty";
import { readProperty } from "./readProperty";

type Stringify = (value: unknown) => string;

/**
 * Shows a rendered doc's frontmatter as a Properties panel in place of its YAML, loading the YAML parser only when the
 * doc has frontmatter
 *
 * @param container the rendered doc, before it is inserted into the page
 * @returns once the panel is built; YAML with errors, or whose top level is not a mapping, stays as code under a
 *   "frontmatter" header
 */
export async function renderFrontMatter(container: ParentNode): Promise<void> {
  const block = container.querySelector("[data-front-matter]");
  if (block === null) {
    return;
  }
  const { parseDocument, stringify } = await import("yaml");
  const yamlDocument = parseDocument(block.textContent);
  const properties: unknown = yamlDocument.errors.length === 0 ? yamlDocument.toJS() : undefined;
  if (properties === null || isMapping(properties)) {
    block.replaceChildren(createPropertiesPanel(block.ownerDocument, Object.entries(properties ?? {}), stringify));
  } else {
    block.setAttribute("data-language", "frontmatter");
  }
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createPropertiesPanel(page: Document, entries: [string, unknown][], stringify: Stringify): HTMLElement {
  const panel = createElement(page, "details", "", { "data-properties": "", open: "" });
  panel.append(createElement(page, "summary", "Properties", {}), createPropertyList(page, entries, stringify));
  return panel;
}

function createPropertyList(page: Document, entries: [string, unknown][], stringify: Stringify): HTMLElement {
  if (entries.length === 0) {
    return createElement(page, "p", "No properties", { "data-empty": "" });
  }
  const list = page.createElement("dl");
  for (const [key, value] of entries) {
    const property = readProperty(key, value);
    const definition = page.createElement("dd");
    definition.append(...createValueNodes(page, property, stringify));
    list.append(createElement(page, "dt", key, { "data-type": property.kind }), definition);
  }
  return list;
}

function createValueNodes(page: Document, property: Property, stringify: Stringify): Node[] {
  switch (property.kind) {
    case "checkbox":
      return [createCheckbox(page, property.isTicked)];
    case "empty":
      return [createElement(page, "span", "Empty", { "data-empty": "" })];
    case "link":
      return [createElement(page, "a", property.text, { href: property.text })];
    case "list":
    case "tags": {
      const attributes = property.kind === "tags" ? { "data-chip": "", "data-tag": "" } : { "data-chip": "" };
      return property.items.map((item) => createElement(page, "span", item, attributes));
    }
    case "nested":
      return [createElement(page, "pre", stringify(property.value).trimEnd(), {})];
    case "date":
    case "number":
    case "text":
      return [page.createTextNode(property.text)];
  }
}

function createCheckbox(page: Document, isTicked: boolean): HTMLElement {
  const checkbox = createElement(page, "input", "", { disabled: "", type: "checkbox" });
  if (isTicked) {
    checkbox.setAttribute("checked", "");
  }
  return checkbox;
}

// Attributes rather than properties, since the panel is built in a template and only its markup reaches the page
function createElement(page: Document, tagName: string, text: string, attributes: Record<string, string>): HTMLElement {
  const element = page.createElement(tagName);
  element.textContent = text;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}
```

Replace the body of `renderDocument` in `src/web/rendering/renderDocument.ts`, and add `import { renderFrontMatter } from "./renderFrontMatter";` after the `pointLinksAtReview` import:

```ts
export async function renderDocument(source: string, documentPath: string): Promise<string> {
  const highlight = await loadHighlight(findFenceLanguages(source));
  const template = document.createElement("template");
  template.innerHTML = sanitizeRenderedHtml(createMarkdownIt({ highlight }).render(source));
  await renderFrontMatter(template.content);
  addHeadingIds(template.content);
  pointLinksAtReview(template.content, documentPath);
  addHeadingLinks(template.content);
  return template.innerHTML;
}
```

In its doc comment, change "with fenced code highlighted" to "with frontmatter shown as properties, fenced code highlighted".

- [ ] **Step 11: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project web src/web/rendering`
Expected: PASS.

- [ ] **Step 12: Add frontmatter to the conformance corpus**

At the very top of `src/web/rendering/testing/conformanceCorpus.md`, before "# Conformance corpus", add:

```markdown
---
title: Conformance corpus
tags: [one, two]
---

```

Run: `pnpm exec vitest run --project web src/web/rendering/blockConformance.test.ts`
Expected: PASS. Block 0 is the frontmatter, lines 1 to 4.

- [ ] **Step 13: Style the panel**

Add to `src/web/components/DocumentView/DocumentView.module.css`:

```css
.content [data-properties] {
  background-color: var(--sui-color-surface);
  border: var(--sui-border-width) solid var(--sui-color-border);
  border-radius: var(--sui-radius-lg);
  font-size: var(--sui-font-size-sm);
}

.content [data-properties] > summary {
  align-items: center;
  color: var(--sui-color-text-muted);
  cursor: pointer;
  display: flex;
  font-size: 0.75rem;
  font-weight: var(--sui-font-weight-bold);
  gap: var(--sui-space-2);
  letter-spacing: 0.06em;
  list-style: none;
  padding: var(--sui-space-2) var(--sui-space-3);
  text-transform: uppercase;
}

/* Safari draws its own disclosure triangle unless this marker is hidden */
.content [data-properties] > summary::-webkit-details-marker {
  display: none;
}

.content [data-properties] > summary::before {
  block-size: 0.4rem;
  border-block-end: 1.5px solid currentColor;
  border-inline-end: 1.5px solid currentColor;
  content: "";
  inline-size: 0.4rem;
  rotate: -45deg;
}

.content [data-properties][open] > summary {
  border-block-end: var(--sui-border-width) solid var(--sui-color-border);
}

.content [data-properties][open] > summary::before {
  rotate: 45deg;
}

.content [data-properties] dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  margin: 0;
  padding-block: var(--sui-space-2);
}

.content [data-properties] dt,
.content [data-properties] dd {
  margin: 0;
  padding: var(--sui-space-1) var(--sui-space-3);
}

.content [data-properties] dt {
  align-items: center;
  color: var(--sui-color-text-muted);
  display: flex;
  gap: var(--sui-space-2);
}

.content [data-properties] dt::before {
  background-color: currentColor;
  block-size: 14px;
  content: "";
  flex: none;
  inline-size: 14px;
  mask: var(--property-icon) center / contain no-repeat;
}

.content [data-properties] dd {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sui-space-1);
}

.content [data-properties] dd > pre {
  background-color: var(--sui-color-background);
  inline-size: 100%;
  margin: 0;
  padding: var(--sui-space-2);
}

.content [data-properties] [data-empty] {
  color: var(--sui-color-text-muted);
}

.content [data-properties] > [data-empty] {
  margin: 0;
  padding: var(--sui-space-2) var(--sui-space-3);
}

.content [data-chip] {
  background-color: var(--sui-color-secondary-subtle);
  border: var(--sui-border-width) solid var(--sui-color-border);
  border-radius: var(--sui-radius-full);
  font-size: 0.8125rem;
  padding-inline: var(--sui-space-2);
}

.content [data-chip][data-tag] {
  background-color: var(--sui-color-primary-subtle);
  border-color: transparent;
  color: var(--sui-color-primary);
}

.content dt[data-type="text"],
.content dt[data-type="empty"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 4h10M3 8h10M3 12h6'/%3E%3C/svg%3E");
}

.content dt[data-type="number"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2.5 4.5 13.5M11.5 2.5 10 13.5M2.5 6h11M2 10.5h11'/%3E%3C/svg%3E");
}

.content dt[data-type="checkbox"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2.5' y='2.5' width='11' height='11' rx='2'/%3E%3Cpath d='M5 8.5l2 2 4-4.5'/%3E%3C/svg%3E");
}

.content dt[data-type="date"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2.5' y='3.5' width='11' height='10' rx='1.5'/%3E%3Cpath d='M2.5 6.5h11M5.5 2v3M10.5 2v3'/%3E%3C/svg%3E");
}

.content dt[data-type="link"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 9a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8M9 7a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8'/%3E%3C/svg%3E");
}

.content dt[data-type="list"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 4h7M6 8h7M6 12h7M3 4h.01M3 8h.01M3 12h.01'/%3E%3C/svg%3E");
}

.content dt[data-type="tags"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 2.5h5l6 6-5 5-6-6z'/%3E%3Ccircle cx='5.5' cy='5.5' r='1'/%3E%3C/svg%3E");
}

.content dt[data-type="nested"] {
  --property-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3v5a2 2 0 0 0 2 2h8M10 7l3 3-3 3'/%3E%3C/svg%3E");
}
```

- [ ] **Step 14: Write the end-to-end test**

Add to `src/e2e/rendering.e2e.ts`:

```ts
test("must show frontmatter as properties and take a comment on the whole of it", async ({ page, review }) => {
  await review.writeDocument("docs/plan.md", `---\ntitle: Plan\nstatus: draft\n---\n\n${plan}`);
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });
  await expect(article.getByRole("term")).toHaveText(["title", "status"]);

  await article.getByRole("definition").first().hover();
  await page.getByRole("button", { name: "Comment on this block" }).click();
  await page.keyboard.type("Status should be review.");
  await page.getByRole("region", { name: "New comment" }).getByRole("button", { exact: true, name: "Save" }).click();

  await expect(page.getByRole("region", { name: "Drafts" }).getByRole("article")).toContainText("status: draft");
});
```

Run: `pnpm test:e2e src/e2e/rendering.e2e.ts`
Expected: PASS in Chromium and WebKit, with no console errors, so the Content Security Policy allows the icons.

- [ ] **Step 15: Run every test, lint and typecheck**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: PASS, including the integration tests, which build and run the CLI with the new block rule.

- [ ] **Step 16: Visual check**

Run the visual check. Confirm:
- The corpus opens with a Properties panel: an uppercase "Properties" summary with a chevron that folds the panel, then muted keys with icons and the values (tag chips for `tags`).
- Pressing + beside the panel frames it and starts a comment quoting the YAML.
- It looks right in both modes.

Then put `title: [unclosed` in the corpus's frontmatter and confirm the YAML shows as code under a "frontmatter" header.

- [ ] **Step 17: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/markdown src/web/rendering src/web/components/DocumentView/DocumentView.module.css src/e2e/rendering.e2e.ts
git commit -m "Show YAML frontmatter as a Properties panel that takes whole-block comments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Describe the new rendering in the design spec, the side panel spec and the README, and verify everything

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-markdown-review-design.md`
- Modify: `docs/superpowers/specs/2026-10-09-document-rendering-design.md`
- Modify: `docs/superpowers/specs/2026-10-09-side-panel-redesign-design.md`
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Update the design spec**

In `docs/superpowers/specs/2026-10-08-markdown-review-design.md`:

1. Under "### Non-goals (MVP)", change "- Front matter rendering, footnotes, math." to "- Footnotes and math.".
2. Under "### Canonical text", after the bullet beginning "HTML blocks and Mermaid fences accept whole-block comments only", add:

   ```markdown
   - YAML frontmatter (a `---` first line, followed by a line that is not blank, through the next `---` or `...` line) is one block that accepts whole-block comments only. Its `text` is the YAML between the fences, and its lines start on line 2.
   - A GitHub alert's marker line (`> [!NOTE]` and the other four) is not part of the canonical text. Its paragraphs are blocks, as in a blockquote, and its title is marked `data-md-ignore`.
   ```

3. Under "### When re-anchoring runs", add at the end:

   ```markdown
   - The source hash is the SHA-256 of `anchoringVersion`, a newline and the source. `anchoringVersion` goes up whenever the same source would give different canonical text, so every stored doc re-anchors once on its next read. See the [document rendering spec](2026-10-09-document-rendering-design.md#8-re-anchoring-after-this-change).
   ```

4. Under "### Highlights", add:

   ```markdown
   - Threads are highlighted with a tint and an underline, deeper where two overlap; the hovered, selected and pending passages paint over them in that order. Pointing at a highlight or its card emphasises the other. While the pointer or focus is on the gutter +, or a whole-block comment is being written, its block is framed. See the [document rendering spec](2026-10-09-document-rendering-design.md).
   ```

5. Under "## 11. Rendering", change the first bullet to "- Shared `markdown-config`: markdown-it with tables and strikethrough (built in), task lists via `@mdit/plugin-tasklist`, GitHub alerts via `@mdit/plugin-alert`, a frontmatter rule, and the block render rules from section 7.". Then replace the last bullet, "- Front matter, footnotes and math are rendered as plain markdown would render them; no special support.", with:

   ```markdown
   - Fenced code shows its language in a header. Headings get a link to themselves, which puts the section in the address and copies it.
   - Frontmatter is shown as a Properties panel, parsed with `yaml`, which loads only when a doc has frontmatter. YAML with errors, or that is not a mapping, stays as code.
   - Footnotes and math are rendered as plain markdown would render them; no special support.
   ```

- [ ] **Step 2: Record two refinements in the document rendering spec**

In `docs/superpowers/specs/2026-10-09-document-rendering-design.md`, section 7:
- Under "Recognition (shared)", change the first bullet's opening to: "A block rule in `createMarkdownIt`, run before every other block rule, recognises frontmatter when the doc's first line is `---`, allowing trailing whitespace, and its second line is not blank, so a doc that opens with a horizontal rule renders as before."
- In the value table, change the Number row's "Shown as" cell to "The number as YAML reads it, so `1.10` shows as 1.1".

- [ ] **Step 3: Point the side panel spec at the new code block styling**

In `docs/superpowers/specs/2026-10-09-side-panel-redesign-design.md`, section 10, replace the "**Code blocks.**" bullet with:

```markdown
- **Code blocks.** Superseded by section 4 of the [document rendering spec](2026-10-09-document-rendering-design.md#4-code-blocks): every code block has the prose gap and one frame in both modes, with a language header.
```

- [ ] **Step 4: Update the README**

In `README.md`, replace "Docs render with GitHub-style tables, task lists, syntax-highlighted code and Mermaid diagrams." with:

```markdown
Docs render with GitHub-style tables, task lists, alerts, syntax-highlighted code and Mermaid diagrams. Frontmatter shows as a Properties panel at the top of the doc, and each heading has a link you can copy.
```

- [ ] **Step 5: Verify everything**

Run: `pnpm verify`
Expected: PASS: lint, format check, typecheck and all Vitest projects.

Run: `pnpm test:e2e`
Expected: PASS in Chromium and WebKit.

Run: `pnpm exec fallow audit --quiet`
Expected: no `fail` verdict.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-10-08-markdown-review-design.md docs/superpowers/specs/2026-10-09-document-rendering-design.md docs/superpowers/specs/2026-10-09-side-panel-redesign-design.md README.md
git commit -m "Describe the new document rendering in the specs and the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
