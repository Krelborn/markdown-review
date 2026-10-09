# Two-column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Submit, the agent status and the page alerts in view. The doc and the comments each scroll in their own column under a fixed header, Submit moves to a review bar at the foot of the comments, and in a narrow window the comments become a drawer.

**Architecture:**
- `App` becomes a `PageLayout` exactly `100dvh` tall, holding `TopBar`, a new `PageAlerts` strip, and a CSS grid.
- The grid has three areas: the doc column (`<main>`, the doc's only scroller), the comments column (its own scroller) and a new `ReviewBar`.
- Below 48rem the grid drops to one column. The comments column then shares the doc's cell as a drawer, which `App`'s `isPanelOpen` shows and hides with a CSS class.
- Two hooks stop assuming that the window scrolls:
  - `usePageLocation` resets the doc column.
  - `useRevealSelectedThread` measures against the passage's nearest scrolling ancestor.

**Tech Stack:** React 19.3 with the React Compiler, `@krelborn/stylesui` 0.2.1, CSS modules, `clsx`, Vitest 5 with jsdom and Testing Library, Playwright 1.64 (Chromium and WebKit), oxlint, oxfmt, fallow.

**Spec:** `docs/superpowers/specs/2026-10-09-two-column-layout-design.md`. It changes section 10 of `docs/superpowers/specs/2026-10-08-markdown-review-design.md`.

## Global Constraints

- **Coding standards.** The `coding-standards` plugin's standards are authoritative over this plan's code. That means:
  - props sorted alphabetically in interfaces and JSX, then `aria-*`, then `data-*`;
  - explicit boolean values;
  - `clsx` for conditional classes;
  - full words in identifiers;
  - multi-line JSDoc;
  - tests named `must … when …`, with Arrange-Act-Assert separated by blank lines and one `describe` per file.
- **Breakpoint.** 48rem (768px), the same in `App.module.css` and `ReviewBar.module.css`. Media queries use range syntax: `(width < 48rem)` and `(width >= 48rem)`.
- **Widths.** The comments column is `clamp(18rem, 30vw, 24rem)`. The drawer is `min(24rem, 100% - 3rem)`.
- **Scrolling.** The window never scrolls; only the doc column (`<main>`) and the comments column do. No ancestor of either may use `overflow: hidden`, because `scrollIntoView` can still scroll such an element and would push the header off screen.
- **Drawer.** A closed drawer is hidden with CSS and stays mounted, so unsent text in `ThreadSidebar` survives.
- **Browsers.** Current Chrome, Firefox and Safari; the floor is Chrome 105, Firefox 140 and Safari 17.2. Playwright runs Chromium and WebKit; Firefox does not launch on this machine.
- **fallow audit.** The pre-commit hook runs `fallow audit` against the merge base with `origin/main`.
  - Every new export must be used, by code or tests, in the same commit.
  - No function may exceed cyclomatic 20 or cognitive 15.
  - `App` and `DocumentView` both score cognitive 15 today. fallow adds one for each hook call, and adds weight for each prop past a threshold. This plan keeps both within budget:
    - `DocumentView`, `DocumentPane` and `useDocumentNavigation` take no new props.
    - `App`'s two alerts and its `problems` list move into `PageAlerts`.
    - `App` gains only `useRef` and one `useState`, and uses a module constant for the panel's id instead of `useId`.
- **Dependencies.** No new dependencies.
- **Commits.** Each commit message is one sentence that describes the behaviour, as in `git log`, followed by a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Missing modules.** Vitest's `web` project reports a missing module as `Failed to resolve import "./X" from "…". Does the file exist?`. That is the expected failure wherever a step's test imports a module the task has not written yet.

## Review Focus

These inputs follow from the spec but are easy to miss. Each one has a test in the task that owns the code.

1. **A passage half hidden under the header.** The passage sits between the top of the window and the top of the doc column, and the user clicks its thread's location. It must scroll into view; the old `0..innerHeight` check counted it as on screen. Pinned in Task 1 (`DocumentView.test.tsx`) and Task 2 (`review.e2e.ts`).
2. **A link to a heading far down a long doc.** Resetting the doc column on `navigate` must not undo the scroll to that heading. Pinned in Task 2 (`layout.e2e.ts`).
3. **The agent edits the doc while the user is halfway down it.** The doc column must keep its scroll position. Pinned in Task 2 (`layout.e2e.ts`).
4. **More comments than the column can hold.** Submit, and the menu it opens near the bottom of the window, must stay in full view. Pinned in Task 3 (`layout.e2e.ts`).
5. **The window crosses the breakpoint while the drawer is open.** When wide, the comments show as a column and the toggle is hidden; when narrow again, the drawer is still open. Pinned in Task 4 (`layout.e2e.ts`).

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/web/components/DocumentView/useRevealSelectedThread.ts` | Measures "on screen" against the passage's nearest scrolling ancestor | 1 |
| `src/web/components/DocumentView/DocumentView.test.tsx` | Adds reveal tests inside a scrolling box | 1 |
| `src/web/navigation/usePageLocation.ts` | Takes the doc column's ref; `navigate` resets its `scrollTop` | 2 |
| `src/web/components/App/PageAlerts.tsx` (new) | The connection and unreadable-comments alerts, as a strip under the header | 2 |
| `src/web/components/App/App.tsx` | Builds the shell and grid; owns `isPanelOpen` | 2, 3, 4 |
| `src/web/components/App/App.module.css` | Page height, grid areas, the scrollers, and the narrow drawer | 2, 3, 4 |
| `src/web/components/App/App.test.tsx` | Tests the navigate reset and what opens the panel | 2, 4 |
| `src/web/testing/standInForLayout.ts` | Drops the `window.scrollTo` stand-in, which nothing calls any more | 2 |
| `src/e2e/testing/reviewTest.ts` | Adds the `withParagraphs` and `scrollDocumentToEnd` helpers, and exports `selectText` | 2, 4 |
| `src/e2e/review.e2e.ts` | Makes the reveal test scroll the doc column, and adds a passage hidden under the header | 2 |
| `src/e2e/layout.e2e.ts` (new) | End-to-end layout tests | 2, 3, 4 |
| `src/web/components/ReviewBar/ReviewBar.tsx` (new) | Agent status, Approved badge, Submit, and the Comments toggle | 3, 4 |
| `src/web/components/ReviewBar/ReviewBar.module.css` (new) | Column layout when wide, row layout when narrow, toggle visibility | 3, 4 |
| `src/web/components/ReviewBar/ReviewBar.test.tsx` (new) | The status and submit tests moved from `TopBar`, plus the toggle | 3, 4 |
| `src/web/components/TopBar/TopBar.tsx` | App link, doc path and Docs menu only | 3 |
| `src/web/components/TopBar/TopBar.test.tsx` | Path and Docs menu tests only | 3 |
| `src/web/components/SubmitMenu/SubmitMenu.tsx` | Opens its popover upwards | 3 |
| `README.md` | Says where Submit and the agent status are | 3 |
| `docs/superpowers/specs/2026-10-08-markdown-review-design.md` | Section 10's layout, top bar, review bar and narrow windows | 2, 3, 4 |

---

### Task 1: Count a passage as on screen only inside the box the doc scrolls in

**Files:**
- Modify: `src/web/components/DocumentView/useRevealSelectedThread.ts`
- Test: `src/web/components/DocumentView/DocumentView.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports. `useRevealSelectedThread` keeps its signature. A passage now counts as on screen only when its box lies within the box of its nearest ancestor whose computed `overflow-y` is `auto` or `scroll`. With no such ancestor, the viewport (`0..innerHeight`) is used.

- [ ] **Step 1: Let `setUpTest` render into a given container**

In `src/web/components/DocumentView/DocumentView.test.tsx`, replace `SetUpOptions`, the first line of `setUpTest`, and the `renderBase` call inside its `render`:

```tsx
interface SetUpOptions {
  container?: HTMLElement;
  hash?: string;
  selectedThreadId?: number | null;
  threads?: Thread[];
}

function setUpTest({ container, hash = "", selectedThreadId = null, threads = [] }: SetUpOptions = {}) {
```

```tsx
  const render = async (shown = plan): Promise<void> => {
    rerenderBase = renderBase(view(shown), { container }).rerender;
```

Then add this helper directly after `setUpTest`:

```tsx
/**
 * Sets up a test whose doc renders inside a scrolling box from 100px to 500px down the page, with every range in the
 * doc measured at the given distance down the page
 */
function setUpTestWithScrollContainer({ passageTop }: { passageTop: number }) {
  const scrollContainer = document.createElement("div");
  scrollContainer.style.overflowY = "auto";
  document.body.append(scrollContainer);
  onTestFinished(() => scrollContainer.remove());
  vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 800, 400));
  vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, passageTop, 200, 20));
  const scrolledTo: string[] = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
    scrolledTo.push(this.tagName);
  });
  const setUp = setUpTest({
    container: scrollContainer,
    selectedThreadId: 1,
    threads: [buildThread({ anchor: cacheAnchor, id: 1 })],
  });
  return { ...setUp, scrolledTo };
}
```

- [ ] **Step 2: Write the failing tests**

Add these tests to the `describe("DocumentView")` block, directly after `"must scroll to the doc's heading when the app's page has an element with the same id"`:

```tsx
  test.each([
    { passageTop: 40, side: "above" },
    { passageTop: 600, side: "below" },
  ])(
    "must scroll the selected thread's passage into view when it lies $side the box the doc scrolls in",
    async ({ passageTop }) => {
      const { render, scrolledTo } = setUpTestWithScrollContainer({ passageTop });

      await render();

      await waitFor(() => expect(scrolledTo).toEqual(["P"]));
    }
  );

  test("must leave the doc where it is when the selected thread's passage lies inside the box the doc scrolls in", async () => {
    const { render, scrolledTo } = setUpTestWithScrollContainer({ passageTop: 200 });

    await render();
    await screen.findByRole("button", { name: "Thread #1" });

    expect(scrolledTo).toEqual([]);
  });
```

The marker appears from an effect that runs in the same commit as the reveal's effect, so waiting for the marker means the reveal has already decided.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView/DocumentView.test.tsx`

Expected: the two `must scroll the selected thread's passage into view when it lies …` cases FAIL, with `scrolledTo` equal to `[]`. Both 40 and 600 lie inside jsdom's `0..768` window, so the current check does not scroll. Every other test passes.

- [ ] **Step 4: Measure against the nearest scrolling ancestor**

In `src/web/components/DocumentView/useRevealSelectedThread.ts`:

Replace the hook's doc comment:

```ts
/**
 * Scrolls the selected thread's passage into view once for each request to see it, and when its doc first renders,
 * unless the passage is already in sight in the box the doc scrolls in
 *
 * @param threads the doc's threads with a passage in the page
 * @param revealCount the count of requests to see the selected thread, which changes with each new one
 */
```

Replace the condition inside the effect:

```ts
    if (range !== null && !isOnScreen(range)) {
```

Replace `isOnScreen` at the bottom of the file, and add `visibleBox` after it:

```ts
function isOnScreen(range: Range): boolean {
  const box = range.getBoundingClientRect();
  const visible = visibleBox(range.commonAncestorContainer);
  return box.top >= visible.top && box.bottom <= visible.bottom;
}

/**
 * The box through which a node can be seen: that of its nearest ancestor that scrolls, or else the viewport
 */
function visibleBox(node: Node): Pick<DOMRect, "bottom" | "top"> {
  for (let ancestor = node.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const { overflowY } = getComputedStyle(ancestor);
    if (overflowY === "auto" || overflowY === "scroll") {
      return ancestor.getBoundingClientRect();
    }
  }
  return { bottom: innerHeight, top: 0 };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project web src/web/components/DocumentView/DocumentView.test.tsx`

Expected: all tests PASS.

- [ ] **Step 6: Check, then commit**

Run: `pnpm format && pnpm lint && pnpm typecheck`

Expected: no errors.

```bash
git add src/web/components/DocumentView/useRevealSelectedThread.ts src/web/components/DocumentView/DocumentView.test.tsx
git commit -m "Count a thread's passage as on screen only inside the box the doc scrolls in, so a passage hidden by the page around it is scrolled into view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Scroll the doc and the comments in their own columns under a fixed header

**Files:**
- Create: `src/web/components/App/PageAlerts.tsx`
- Create: `src/e2e/layout.e2e.ts`
- Modify: `src/web/navigation/usePageLocation.ts`
- Modify: `src/web/components/App/App.tsx`
- Modify: `src/web/components/App/App.module.css`
- Modify: `src/web/testing/standInForLayout.ts`
- Modify: `src/e2e/testing/reviewTest.ts`
- Modify: `src/e2e/review.e2e.ts`
- Modify: `docs/superpowers/specs/2026-10-08-markdown-review-design.md` (section 10, the layout line)
- Test: `src/web/components/App/App.test.tsx`, `src/e2e/layout.e2e.ts`, `src/e2e/review.e2e.ts`

**Interfaces:**
- Consumes: Task 1's `useRevealSelectedThread` behaviour, exercised by the end-to-end test of a passage under the header.
- Produces:
  - `usePageLocation(scrollContainerRef: RefObject<HTMLElement | null>): PageNavigation`. `navigate` sets `scrollContainerRef.current.scrollTop = 0` synchronously, after `pushState`.
  - `PageAlerts({ isConnected: boolean; threads: ThreadsState }): JSX.Element | null`, from `src/web/components/App/PageAlerts.tsx`.
  - App's doc column is the page's only `<main>`. Its comments column is a `div` with class `styles.commentsPanel` that holds `ThreadSidebar`.
  - CSS classes in `App.module.css`: `page`, `pageAlerts`, `columns`, `documentColumn`, `commentsPanel`.
  - `withParagraphs(source: string, count: number): string`, `scrollDocumentToEnd(page: Page): Promise<void>`, from `src/e2e/testing/reviewTest.ts`.

- [ ] **Step 1: Write the failing component test**

In `src/web/components/App/App.test.tsx`, add `documentColumn` to the `elements` object at the bottom:

```tsx
const elements = {
  article: () => within(screen.getByRole("article", { name: "docs/plan.md" })),
  documentColumn: () => screen.getByRole("main"),
};
```

Add this test after `"must show the doc the user came from when the user goes back"`:

```tsx
  test("must show the doc the agent opens from its top when the user had scrolled down the last one", async () => {
    const { fake, render } = setUpTest();
    await render();
    elements.documentColumn().scrollTop = 400;

    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });

    expect(await screen.findByRole("heading", { level: 1, name: "docs/spec.md" })).toBeInTheDocument();
    expect(elements.documentColumn().scrollTop).toBe(0);
  });
```

jsdom stores `scrollTop` as a plain property, so this checks the reset without any layout.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project web src/web/components/App/App.test.tsx`

Expected: the new test FAILS with `expected 400 to be 0`. Today's `<main>` is the StylesUI `Sidebar`, and `navigate` scrolls the window instead.

- [ ] **Step 3: Add the end-to-end helpers**

In `src/e2e/testing/reviewTest.ts`, add these two exports after `plan`:

```ts
/**
 * @returns the doc's source followed by paragraphs numbered from "Paragraph 1.", enough of them to make it scroll
 */
export function withParagraphs(source: string, count: number): string {
  return [source, ...Array.from({ length: count }, (_, index) => `Paragraph ${index + 1}.`)].join("\n\n");
}

/**
 * Scrolls the doc column to its end, as dragging its scrollbar to the bottom would
 */
export function scrollDocumentToEnd(page: Page): Promise<void> {
  return page.getByRole("main").evaluate((main) => main.scrollTo(0, main.scrollHeight));
}
```

- [ ] **Step 4: Make the existing reveal test scroll the doc column, and hide the passage under the header**

In `src/e2e/review.e2e.ts`, change the imports to:

```ts
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  highlightedText,
  plan,
  scrollDocumentToEnd,
  submitDrafts,
  test,
  withParagraphs,
  writeDraftComment,
} from "./testing/reviewTest";
```

Replace the test `"must scroll the selected thread's passage back into view each time the user clicks its location"` with the test below. Its last step hides the passage under the header, between the top of the window and the top of the doc column, where the old `0..innerHeight` check counted it as on screen. It is one test rather than two so that the end-to-end files do not repeat its setup, which fallow's duplication check would flag.

```ts
test("must scroll the selected thread's passage back into view each time the user clicks its location, even from under the header", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", withParagraphs(plan, 80));
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const passage = page.getByRole("article", { name: "docs/plan.md" }).getByText("We cache results");
  const location = page.getByRole("button", { name: "#1 Line 3" });

  await scrollDocumentToEnd(page);
  await location.click();
  await expect(passage).toBeInViewport();

  await scrollDocumentToEnd(page);
  await expect(passage).not.toBeInViewport();
  await location.click();
  await expect(passage).toBeInViewport({ ratio: 1 });

  await scrollJustPast(passage);
  await expect(passage).not.toBeInViewport({ ratio: 1 });
  await location.click();

  await expect(passage).toBeInViewport({ ratio: 1 });
});
```

Add this helper at the end of `src/e2e/review.e2e.ts`:

```ts
/**
 * Scrolls the doc column until the element's top edge sits just above the column's, under the header
 */
function scrollJustPast(element: Locator): Promise<void> {
  return element.evaluate((target) => {
    const column = target.closest("main");
    if (column === null) {
      throw new Error("The element is not in the doc column");
    }
    column.scrollTop += target.getBoundingClientRect().top - column.getBoundingClientRect().top + 8;
  });
}
```

- [ ] **Step 5: Write the end-to-end layout tests**

Create `src/e2e/layout.e2e.ts`:

```ts
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { plan, scrollDocumentToEnd, test, withParagraphs } from "./testing/reviewTest";

test("must keep the header and Submit in view, and the window still, when the user scrolls to the end of a long doc", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", withParagraphs(plan, 80));
  await review.open("docs/plan.md");

  await scrollDocumentToEnd(page);

  await expect(page.getByText("Paragraph 80.", { exact: true })).toBeInViewport();
  await expect(page.getByRole("heading", { level: 1, name: "docs/plan.md" })).toBeInViewport();
  await expect(page.getByRole("status")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Submit (0)" })).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)
  ).toBe(true);
});

test("must show a linked doc at the heading its link names when the heading is far down the doc", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/spec.md", `${withParagraphs("# Spec", 80)}\n\n## Goals\n\nResults are cached.\n`);
  await review.open("docs/plan.md");

  await page.getByRole("link", { name: "spec" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "docs/spec.md" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Goals" })).toBeInViewport();
});

test("must keep the user's place in a long doc when the agent edits it", async ({ page, review }) => {
  const source = withParagraphs(plan, 80);
  await review.writeDocument("docs/plan.md", source);
  await review.open("docs/plan.md");
  await page.getByText("Paragraph 60.", { exact: true }).scrollIntoViewIfNeeded();
  const scrolledTo = await documentScrollTop(page);
  expect(scrolledTo).toBeGreaterThan(0);

  await review.writeDocument("docs/plan.md", `${source}\n\nParagraph 81.\n`);

  await expect(page.getByText("Paragraph 81.", { exact: true })).toBeAttached();
  expect(await documentScrollTop(page)).toBe(scrolledTo);
});

function documentScrollTop(page: Page): Promise<number> {
  return page.getByRole("main").evaluate((main) => main.scrollTop);
}
```

- [ ] **Step 6: Run the end-to-end tests to verify the layout tests fail**

Run: `pnpm test:e2e src/e2e/layout.e2e.ts src/e2e/review.e2e.ts`

The globalSetup builds the package first. Install the browsers once with `pnpm exec playwright install chromium webkit` if they are missing.

Expected FAILs:
- `must keep the header and Submit in view, …`: "Paragraph 80." is not in the viewport, because `<main>` does not scroll yet.
- `must scroll the selected thread's passage back into view …`: its first `not.toBeInViewport` step fails, because `<main>` does not scroll yet.

The heading test and the agent-edit test may pass already. They guard against regressions in the new layout.

- [ ] **Step 7: Reset the doc column on navigate**

Replace `src/web/navigation/usePageLocation.ts` with:

```ts
import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

export interface PageLocation {
  /**
   * The address's fragment, such as "#goals", or an empty string
   */
  hash: string;

  pathname: string;
}

export interface PageNavigation {
  location: PageLocation;

  /**
   * Shows another page of the app without reloading, as a new entry in the browser's history, from the top of the
   * page's content
   *
   * @param pagePath the page's path, with any fragment
   */
  navigate: (pagePath: string) => void;
}

/**
 * Follows the page's address, including the browser's back and forward buttons
 *
 * @param scrollContainerRef the element the page's content scrolls in
 */
export function usePageLocation(scrollContainerRef: RefObject<HTMLElement | null>): PageNavigation {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const update = (): void => setLocation(readLocation());
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback(
    (pagePath: string): void => {
      history.pushState(null, "", pagePath);
      setLocation(readLocation());
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer !== null) {
        scrollContainer.scrollTop = 0;
      }
    },
    [scrollContainerRef]
  );
  return { location, navigate };
}

function readLocation(): PageLocation {
  return { hash: window.location.hash, pathname: window.location.pathname };
}
```

The reset must stay synchronous inside `navigate`. `useScrollToHeading` runs in a child effect after the new page renders. If the reset ran in an effect in `App` instead, the parent's effect would run after the child's and undo the scroll to the heading.

- [ ] **Step 8: Move the alerts into `PageAlerts`**

Create `src/web/components/App/PageAlerts.tsx`:

```tsx
import { Alert, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ThreadsState } from "../../review/useThreads";

import styles from "./App.module.css";

export interface PageAlertsProps {
  /**
   * Whether the event stream from the review server is connected
   */
  isConnected: boolean;

  threads: ThreadsState;
}

/**
 * The alerts across the page beneath the top bar: a lost connection to the server, and comments that could not be read
 */
export function PageAlerts({ isConnected, threads }: PageAlertsProps): JSX.Element | null {
  const problems = [...(threads.error === null ? [] : [threads.error]), ...(threads.snapshot?.problems ?? [])];
  if (isConnected && problems.length === 0) {
    return null;
  }
  return (
    <Stack className={styles.pageAlerts} gap={2}>
      {!isConnected && (
        <Alert role="alert" title="Lost the connection to the review server" tone="warning">
          Trying again. If the server has stopped, ask the agent to run <code>markdown-review open</code>, which
          starts it again.
        </Alert>
      )}
      {problems.length > 0 && (
        <Alert title="Some comments could not be read" tone="danger">
          {problems.join(" ")}
        </Alert>
      )}
    </Stack>
  );
}
```

- [ ] **Step 9: Build the shell in `App`**

Replace `src/web/components/App/App.tsx` with:

```tsx
import { PageLayout, Theme } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useMemo, useRef, useState } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { useReviewApi } from "../../api/useReviewApi";
import { useReviewEvents } from "../../api/useReviewEvents";
import { documentPathOf } from "../../navigation/documentPathOf";
import { usePageLocation } from "../../navigation/usePageLocation";
import { countDrafts } from "../../review/countDrafts";
import type { NewComment } from "../../review/NewComment";
import { useDocumentSource } from "../../review/useDocumentSource";
import { useThreads } from "../../review/useThreads";
import { useThreadSelection } from "../../review/useThreadSelection";
import { DocumentsPage } from "../DocumentsPage/DocumentsPage";
import { ThreadSidebar } from "../ThreadSidebar/ThreadSidebar";
import { TopBar } from "../TopBar/TopBar";

import styles from "./App.module.css";
import { DocumentPane } from "./DocumentPane";
import { PageAlerts } from "./PageAlerts";

const unrequestedReview: ReviewState = { approved: false, approvedAt: null, requestedAt: null };

/**
 * The review page: the bar across the top and any alerts, then the docs list or a doc beside the comments, each
 * scrolling on its own
 */
export function App(): JSX.Element {
  const api = useReviewApi();
  const documentColumnRef = useRef<HTMLElement>(null);
  const { location, navigate } = usePageLocation(documentColumnRef);
  const documentPath = documentPathOf(location.pathname);
  const threads = useThreads(api);
  const documentSource = useDocumentSource(api, documentPath);
  const selection = useThreadSelection(documentPath, navigate);
  const [newComment, setNewComment] = useState<NewComment | null>(null);
  const connection = useReviewEvents(api, {
    onDocumentChanged: (document) => {
      if (document === documentPath) {
        documentSource.refresh();
      }
    },
    onNavigate: (url) => {
      const page = new URL(url);
      navigate(page.pathname + page.hash);
    },
    onReconnected: () => {
      threads.refresh();
      documentSource.refresh();
    },
    onThreadsChanged: threads.refresh,
  });
  const allThreads = useMemo(() => threads.snapshot?.threads ?? [], [threads.snapshot]);
  const documentThreads = useMemo(
    () => allThreads.filter(({ anchor }) => anchor.kind !== "review" && anchor.document === documentPath),
    [allThreads, documentPath]
  );
  return (
    <Theme mode="system">
      <PageLayout className={styles.page}>
        <TopBar
          agentWaiting={connection.agentWaiting}
          documentPath={documentPath}
          draftCount={countDrafts(allThreads)}
          onNavigate={navigate}
          onSubmitted={threads.refresh}
          review={threads.snapshot?.review ?? unrequestedReview}
        />
        <PageAlerts isConnected={connection.isConnected} threads={threads} />
        <div className={styles.columns}>
          <main className={styles.documentColumn} ref={documentColumnRef}>
            {documentPath === null ? (
              <DocumentsPage onNavigate={navigate} threads={allThreads} />
            ) : (
              <DocumentPane
                documentPath={documentPath}
                hash={location.hash}
                onComment={setNewComment}
                onNavigate={navigate}
                onSelectThread={selection.selectThread}
                revealCount={selection.revealCount}
                selectedThreadId={selection.selectedThreadId}
                state={documentSource.state}
                threads={documentThreads}
              />
            )}
          </main>
          <div className={styles.commentsPanel}>
            <ThreadSidebar
              documentPath={documentPath}
              newComment={newComment}
              onChanged={threads.refresh}
              onCloseNewComment={() => setNewComment(null)}
              onSelectThread={selection.revealThread}
              selectedThreadId={selection.selectedThreadId}
              threads={allThreads}
            />
          </div>
        </div>
      </PageLayout>
    </Theme>
  );
}
```

Replace `src/web/components/App/App.module.css` with:

```css
.page {
  block-size: 100dvh;
}

.pageAlerts {
  padding: var(--sui-space-2) var(--sui-space-4);
}

.columns {
  display: grid;
  flex-grow: 1;
  grid-template-areas: "document comments";
  grid-template-columns: minmax(0, 1fr) clamp(18rem, 30vw, 24rem);
  grid-template-rows: minmax(0, 1fr);
  min-block-size: 0;
}

.documentColumn {
  grid-area: document;
  overflow-y: auto;
  padding: var(--sui-space-4);
}

.commentsPanel {
  border-inline-start: var(--sui-border-width) solid var(--sui-color-border);
  grid-area: comments;
  overflow-y: auto;
  padding: var(--sui-space-4);
}
```

- [ ] **Step 10: Remove the unused `window.scrollTo` stand-in**

In `src/web/testing/standInForLayout.ts`, delete the last line:

```ts
globalThis.scrollTo = () => {};
```

Nothing calls the window's `scrollTo` any more. Leave the rest of the file as it is.

- [ ] **Step 11: Run the component tests to verify they pass**

Run: `pnpm exec vitest run --project web`

Expected: all tests PASS, including `"must show the doc the agent opens from its top when the user had scrolled down the last one"` and the existing connection-alert test.

- [ ] **Step 12: Run the end-to-end tests to verify they pass**

Run: `pnpm test:e2e`

Expected: every test PASSES in Chromium and WebKit.

- [ ] **Step 13: Update the layout line in the design spec**

In `docs/superpowers/specs/2026-10-08-markdown-review-design.md`, section 10, replace:

```markdown
Layout: top bar, document view, fixed right sidebar, built from StylesUI components (for example `PageLayout`, `Sidebar`, `Prose`, `SegmentedControl` and `Popover`).
```

with:

```markdown
Layout: a page exactly the height of the window, which itself never scrolls. It holds the top bar, any page alerts beneath it, and then the document view beside the sidebar, each scrolling on its own. It is built from StylesUI components (for example `PageLayout`, `Prose`, `SegmentedControl` and `Popover`) and a CSS grid. See the [two-column layout spec](2026-10-09-two-column-layout-design.md).
```

- [ ] **Step 14: Check, then commit**

Run: `pnpm format && pnpm lint && pnpm typecheck`

Expected: no errors.

```bash
git add src/web/navigation/usePageLocation.ts src/web/components/App src/web/testing/standInForLayout.ts src/e2e docs/superpowers/specs/2026-10-08-markdown-review-design.md
git commit -m "Scroll the doc and the comments in their own columns under a fixed header, so the header, Submit and alerts stay in view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Move Submit, the agent status and the Approved badge to a review bar at the foot of the comments

**Files:**
- Create: `src/web/components/ReviewBar/ReviewBar.tsx`
- Create: `src/web/components/ReviewBar/ReviewBar.module.css`
- Create: `src/web/components/ReviewBar/ReviewBar.test.tsx`
- Modify: `src/web/components/TopBar/TopBar.tsx`
- Modify: `src/web/components/TopBar/TopBar.test.tsx`
- Modify: `src/web/components/SubmitMenu/SubmitMenu.tsx`
- Modify: `src/web/components/App/App.tsx`
- Modify: `src/web/components/App/App.module.css`
- Modify: `src/e2e/testing/reviewTest.ts` (the `submitDrafts` doc comment)
- Modify: `src/e2e/layout.e2e.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-08-markdown-review-design.md` (section 10, the top bar and the new review bar)

**Interfaces:**
- Consumes:
  - Task 2's grid: `styles.columns` and `styles.commentsPanel` in `App.module.css`.
  - The `layout.e2e.ts` file and its imports.
- Produces:
  - `ReviewBar({ agentWaiting: boolean; draftCount: number; onSubmitted: () => void; review: ReviewState }): JSX.Element`, from `src/web/components/ReviewBar/ReviewBar.tsx`. It renders a `<section aria-label="Review">`.
  - `TopBar({ documentPath: string | null; onNavigate: (pagePath: string) => void }): JSX.Element`.
  - CSS class `reviewBar` in `App.module.css`, for the grid area.

- [ ] **Step 1: Write the failing `ReviewBar` tests**

Create `src/web/components/ReviewBar/ReviewBar.test.tsx`:

```tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ReviewBar } from "./ReviewBar";

const draftThread = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

describe("ReviewBar", () => {
  test("must say the agent is waiting when the agent has a poll open", () => {
    const { render } = setUpTest();

    render({ agentWaiting: true });

    expect(screen.getByRole("status")).toHaveTextContent("Agent waiting");
  });

  test("must say comments will wait in the inbox when the agent is not listening", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("status")).toHaveTextContent("Agent not listening, comments will wait in the inbox");
  });

  test("must show the review as approved when the user approved this round", () => {
    const { render } = setUpTest();

    render({ review: { approved: true, approvedAt: testTime, requestedAt: testTime } });

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  test("must offer only approval when the user has no drafts", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 0 });

    await user.click(screen.getByRole("button", { name: "Submit (0)" }));

    expect(elements.submitDialog().getByRole("button", { name: "Request changes" })).toBeDisabled();
    expect(elements.submitDialog().getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  test("must send the drafts to the agent when the user requests changes", async () => {
    const { fake, onSubmitted, render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Request changes" }));

    expect(fake.snapshot.threads).toMatchObject([{ messages: [{ author: "user", body: "Why 24h?" }], status: "open" }]);
    expect(fake.snapshot.review.approved).toBe(false);
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test("must approve the review when the user approves", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Approve" }));

    expect(fake.snapshot.review.approved).toBe(true);
  });

  test("must show why when the server refuses the submit", async () => {
    const { fake, render } = setUpTest();
    fake.api.submit.mockRejectedValueOnce(new ReviewApiError(409, "invalid-state", "There are no drafts to submit"));
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Request changes" }));

    expect(await elements.submitDialog().findByRole("alert")).toHaveTextContent("There are no drafts to submit");
  });
});

interface RenderOptions {
  agentWaiting?: boolean;
  draftCount?: number;
  review?: ReviewState;
}

function setUpTest() {
  const fake = createFakeReviewApi({ threads: [draftThread] });
  const onSubmitted = vi.fn();
  const render = ({
    agentWaiting = false,
    draftCount = 0,
    review = fake.snapshot.review,
  }: RenderOptions = {}): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ReviewBar agentWaiting={agentWaiting} draftCount={draftCount} onSubmitted={onSubmitted} review={review} />
      </ReviewApiContext>
    );
  };
  return { fake, onSubmitted, render };
}

const elements = {
  submitDialog: () => within(screen.getByRole("dialog", { name: "Submit review" })),
};
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/components/ReviewBar/ReviewBar.test.tsx`

Expected: FAIL with `Failed to resolve import "./ReviewBar" from "src/web/components/ReviewBar/ReviewBar.test.tsx". Does the file exist?`

- [ ] **Step 3: Write `ReviewBar`**

Create `src/web/components/ReviewBar/ReviewBar.tsx`:

```tsx
import { Badge, Cluster } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./ReviewBar.module.css";

export interface ReviewBarProps {
  agentWaiting: boolean;
  draftCount: number;

  /**
   * Called after the user submits their drafts
   */
  onSubmitted: () => void;

  review: ReviewState;
}

/**
 * The bar beneath the comments: whether the agent is listening, whether the review is approved, and the submit button
 */
export function ReviewBar({ agentWaiting, draftCount, onSubmitted, review }: ReviewBarProps): JSX.Element {
  return (
    <section className={styles.reviewBar} aria-label="Review">
      <Cluster gap={3}>
        <AgentStatus agentWaiting={agentWaiting} />
        {review.approved && (
          <Badge tone="success" variant="solid">
            Approved
          </Badge>
        )}
      </Cluster>
      <SubmitMenu draftCount={draftCount} onSubmitted={onSubmitted} />
    </section>
  );
}
```

Create `src/web/components/ReviewBar/ReviewBar.module.css`:

```css
.reviewBar {
  display: flex;
  flex-direction: column;
  gap: var(--sui-space-3);
  padding: var(--sui-space-3) var(--sui-space-4);
}
```

The column stretches the Submit button to the bar's full width. `SubmitMenu`'s closed popover is `display: none`, so it takes no space.

- [ ] **Step 4: Run the `ReviewBar` tests to verify they pass**

Run: `pnpm exec vitest run --project web src/web/components/ReviewBar/ReviewBar.test.tsx`

Expected: all 7 tests PASS.

- [ ] **Step 5: Open the submit menu upwards**

In `src/web/components/SubmitMenu/SubmitMenu.tsx`, replace:

```tsx
  const popover = usePopover({ placement: "bottom" });
```

with:

```tsx
  const popover = usePopover({ placement: "top" });
```

- [ ] **Step 6: Slim `TopBar` down to navigation**

Replace `src/web/components/TopBar/TopBar.tsx` with:

```tsx
import { Cluster, Heading, Link } from "@krelborn/stylesui";
import type { JSX } from "react";

import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";
import { DocumentsMenu } from "../DocumentsMenu/DocumentsMenu";

import styles from "./TopBar.module.css";

export interface TopBarProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;
}

/**
 * The bar across the top of the page: where the user is, and the menu of docs to go to
 */
export function TopBar({ documentPath, onNavigate }: TopBarProps): JSX.Element {
  return (
    <Cluster as="header" className={styles.topBar} gap={3}>
      <Link
        href="/"
        onClick={(event) => {
          if (isPlainLeftClick(event)) {
            event.preventDefault();
            onNavigate("/");
          }
        }}
        tone="inherit"
        underline="hover"
      >
        Markdown Review
      </Link>
      <Heading className={styles.path} level={1} size="md">
        {documentPath ?? "Docs"}
      </Heading>
      <DocumentsMenu onNavigate={onNavigate} />
    </Cluster>
  );
}
```

Replace `src/web/components/TopBar/TopBar.test.tsx` with:

```tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { TopBar } from "./TopBar";

const draftThread = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

describe("TopBar", () => {
  test("must show the doc's path when a doc is on screen", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("heading", { level: 1, name: "docs/plan.md" })).toBeInTheDocument();
  });

  test("must list docs with comments, then other recent docs, when the user opens the docs menu", async () => {
    const { render } = setUpTest({ recent: ["docs/spec.md", "docs/plan.md"] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Docs" }));

    const docs = within(screen.getByRole("navigation", { name: "Docs" }));
    expect(await docs.findByRole("link", { name: "docs/plan.md 0 open, 1 draft" })).toHaveAttribute(
      "href",
      "/document/docs/plan.md"
    );
    expect(docs.getByRole("link", { name: "docs/spec.md" })).toHaveAttribute("href", "/document/docs/spec.md");
  });

  test("must show the chosen doc in the page when the user picks it from the docs menu", async () => {
    const { onNavigate, render } = setUpTest({ recent: ["docs/spec.md"] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Docs" }));
    await user.click(await screen.findByRole("link", { name: "docs/spec.md" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md");
  });
});

function setUpTest({ recent = [] }: { recent?: string[] } = {}) {
  const fake = createFakeReviewApi({ recent, threads: [draftThread] });
  const onNavigate = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <TopBar documentPath="docs/plan.md" onNavigate={onNavigate} />
      </ReviewApiContext>
    );
  };
  return { onNavigate, render };
}
```

- [ ] **Step 7: Put the review bar under the comments in `App`**

In `src/web/components/App/App.tsx`:

Add the import, in alphabetical order among the `../` imports:

```tsx
import { ReviewBar } from "../ReviewBar/ReviewBar";
```

Replace the `TopBar` element with:

```tsx
        <TopBar documentPath={documentPath} onNavigate={navigate} />
```

Add this after the closing `</div>` of the `styles.commentsPanel` div, still inside `styles.columns`:

```tsx
          <div className={styles.reviewBar}>
            <ReviewBar
              agentWaiting={connection.agentWaiting}
              draftCount={countDrafts(allThreads)}
              onSubmitted={threads.refresh}
              review={threads.snapshot?.review ?? unrequestedReview}
            />
          </div>
```

Update the component's doc comment:

```tsx
/**
 * The review page: the bar across the top and any alerts, then the docs list or a doc beside the comments and the
 * review bar, each column scrolling on its own
 */
```

In `src/web/components/App/App.module.css`, replace the `.columns` rule and add `.reviewBar` after `.commentsPanel`:

```css
.columns {
  display: grid;
  flex-grow: 1;
  grid-template-areas:
    "document comments"
    "document review";
  grid-template-columns: minmax(0, 1fr) clamp(18rem, 30vw, 24rem);
  grid-template-rows: minmax(0, 1fr) auto;
  min-block-size: 0;
}
```

```css
.reviewBar {
  border-block-start: var(--sui-border-width) solid var(--sui-color-border);
  border-inline-start: var(--sui-border-width) solid var(--sui-color-border);
  grid-area: review;
}
```

- [ ] **Step 8: Run the component tests to verify they pass**

Run: `pnpm exec vitest run --project web`

Expected: all tests PASS. The App tests that find `Agent waiting`, `Submit (N)` and the connection alert pass unchanged, because they query by role and text.

- [ ] **Step 9: Add the end-to-end test for a long list of comments**

In `src/e2e/testing/reviewTest.ts`, change `submitDrafts`'s doc comment from `Submits the user's drafts from the top bar` to:

```ts
/**
 * Submits the user's drafts from the review bar
 *
 * @param draftCount how many drafts the submit button counts
 * @param verdict the menu's button for the verdict
 */
```

Add this test to `src/e2e/layout.e2e.ts`, after `"must keep the user's place in a long doc when the agent edits it"`:

```ts
test("must keep Submit and its menu in full view when the comments outgrow their column", async ({ page, review }) => {
  await review.open("docs/plan.md");
  for (let count = 1; count <= 12; count++) {
    await page.getByRole("textbox", { name: "Comment on the whole review" }).fill(`Note ${count}`);
    await page.getByRole("button", { name: "Add comment" }).click();
    await expect(page.getByRole("button", { exact: true, name: `Submit (${count})` })).toBeVisible();
  }

  await page.getByRole("button", { exact: true, name: "Submit (12)" }).click();

  await expect(page.getByRole("button", { exact: true, name: "Submit (12)" })).toBeInViewport();
  await expect(page.getByRole("dialog", { name: "Submit review" })).toBeInViewport({ ratio: 1 });
});
```

- [ ] **Step 10: Run the end-to-end tests to verify they pass**

Run: `pnpm test:e2e`

Expected: every test PASSES in Chromium and WebKit, including the new one and `"must end the agent's poll when the user approves the review"`, which looks for the Approved badge.

- [ ] **Step 11: Update the README and the design spec**

In `README.md`, replace:

```markdown
Comments start as drafts. When you are ready, click **Submit** in the top bar and choose:
```

with:

```markdown
Comments start as drafts. When you are ready, click **Submit** at the foot of the comments and choose:
```

and replace:

```markdown
The top bar shows whether the agent is waiting for you. If it is not, your comments wait in its inbox until it next looks.
```

with:

```markdown
The bar beneath the comments shows whether the agent is waiting for you. If it is not, your comments wait in its inbox until it next looks.
```

In `docs/superpowers/specs/2026-10-08-markdown-review-design.md`, section 10, replace the whole `### Top bar` subsection:

```markdown
### Top bar

- Doc path (repo-relative).
- **Docs** menu: docs with open or draft threads, with counts, plus recently opened docs.
- Agent status: "Agent waiting" while a poll is open, otherwise "Agent not listening, comments will wait in the inbox".
- An "Approved" badge while the review is approved.
- **Submit (N)**, where N is the number of draft threads and draft replies across the whole repo. It offers **Request changes** (disabled when N is 0) and **Approve** (always available; submits any drafts too).
```

with:

```markdown
### Top bar

- Doc path (repo-relative).
- **Docs** menu: docs with open or draft threads, with counts, plus recently opened docs.

### Review bar

The review bar sits at the foot of the sidebar and stays in view whatever the user has scrolled. It holds:

- Agent status: "Agent waiting" while a poll is open, otherwise "Agent not listening, comments will wait in the inbox".
- An "Approved" badge while the review is approved.
- **Submit (N)**, where N is the number of draft threads and draft replies across the whole repo. It offers **Request changes** (disabled when N is 0) and **Approve** (always available; submits any drafts too). Its menu opens above the button.
```

- [ ] **Step 12: Check, then commit**

Run: `pnpm format && pnpm lint && pnpm typecheck`

Expected: no errors.

```bash
git add src/web/components/ReviewBar src/web/components/TopBar src/web/components/SubmitMenu/SubmitMenu.tsx src/web/components/App src/e2e README.md docs/superpowers/specs/2026-10-08-markdown-review-design.md
git commit -m "Move Submit, the agent status and the Approved badge to a review bar at the foot of the comments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Turn the comments into a drawer the user opens from the review bar when the window is narrow

**Files:**
- Modify: `src/web/components/ReviewBar/ReviewBar.tsx`
- Modify: `src/web/components/ReviewBar/ReviewBar.module.css`
- Modify: `src/web/components/ReviewBar/ReviewBar.test.tsx`
- Modify: `src/web/components/App/App.tsx`
- Modify: `src/web/components/App/App.module.css`
- Modify: `src/web/components/App/App.test.tsx`
- Modify: `src/e2e/testing/reviewTest.ts` (export `selectText`)
- Modify: `src/e2e/layout.e2e.ts`
- Modify: `docs/superpowers/specs/2026-10-08-markdown-review-design.md` (section 10, narrow windows)

**Interfaces:**
- Consumes:
  - Task 3's `ReviewBar` and its test file.
  - Task 2's `styles.commentsPanel` div in `App`.
- Produces:
  - `ReviewBar` gains the props `isPanelOpen: boolean`, `onTogglePanel: () => void` and `panelId: string`. It renders a `Comments` button with `aria-expanded={isPanelOpen}` and `aria-controls={panelId}`, shown only below 48rem.
  - `App` owns `isPanelOpen`. The comments panel div gets `id="comments-panel"` and the class `styles.open` while open.
  - `selectText(page: Page, from: string, through: string): Promise<void>` is now exported from `src/e2e/testing/reviewTest.ts`.

- [ ] **Step 1: Write the failing `ReviewBar` toggle tests**

In `src/web/components/ReviewBar/ReviewBar.test.tsx`, replace `RenderOptions`, `setUpTest` and `elements` with:

```tsx
interface RenderOptions {
  agentWaiting?: boolean;
  draftCount?: number;
  isPanelOpen?: boolean;
  review?: ReviewState;
}

function setUpTest() {
  const fake = createFakeReviewApi({ threads: [draftThread] });
  const onSubmitted = vi.fn();
  const onTogglePanel = vi.fn();
  const render = ({
    agentWaiting = false,
    draftCount = 0,
    isPanelOpen = false,
    review = fake.snapshot.review,
  }: RenderOptions = {}): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ReviewBar
          agentWaiting={agentWaiting}
          draftCount={draftCount}
          isPanelOpen={isPanelOpen}
          onSubmitted={onSubmitted}
          onTogglePanel={onTogglePanel}
          panelId="comments-panel"
          review={review}
        />
      </ReviewApiContext>
    );
  };
  return { fake, onSubmitted, onTogglePanel, render };
}

const elements = {
  panelToggle: () => screen.getByRole("button", { name: "Comments" }),
  submitDialog: () => within(screen.getByRole("dialog", { name: "Submit review" })),
};
```

Add these tests at the end of the `describe("ReviewBar")` block:

```tsx
  test.each([
    { expanded: "false", isPanelOpen: false },
    { expanded: "true", isPanelOpen: true },
  ])(
    "must mark the Comments button expanded $expanded when the panel's open state is $isPanelOpen",
    ({ expanded, isPanelOpen }) => {
      const { render } = setUpTest();

      render({ isPanelOpen });

      expect(elements.panelToggle()).toHaveAttribute("aria-expanded", expanded);
    }
  );

  test("must ask to show or hide the comments when the user presses Comments", async () => {
    const { onTogglePanel, render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(elements.panelToggle());

    expect(onTogglePanel).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Write the failing `App` tests for opening the panel**

In `src/web/components/App/App.test.tsx`, add `panelToggle` to `elements`:

```tsx
const elements = {
  article: () => within(screen.getByRole("article", { name: "docs/plan.md" })),
  documentColumn: () => screen.getByRole("main"),
  panelToggle: () => screen.getByRole("button", { name: "Comments" }),
};
```

Add these tests at the end of the `describe("App")` block:

```tsx
  test("must open the comments when the user starts a comment on the doc", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(await screen.findByRole("button", { name: "Comment on this doc" }));

    expect(elements.panelToggle()).toHaveAttribute("aria-expanded", "true");
  });

  test("must open the comments when the user clicks a thread's marker in the doc", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(await screen.findByRole("button", { name: "Thread #1" }));

    expect(elements.panelToggle()).toHaveAttribute("aria-expanded", "true");
  });

  test("must leave the comments closed when the user shows a thread's passage from the comments", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("button", { name: "#1 Line 3" }));

    expect(elements.panelToggle()).toHaveAttribute("aria-expanded", "false");
  });

  test("must open the comments when the user presses Comments", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(elements.panelToggle());

    expect(elements.panelToggle()).toHaveAttribute("aria-expanded", "true");
  });

  test("must close the comments when the user presses Comments again", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(elements.panelToggle());
    await user.click(elements.panelToggle());

    expect(elements.panelToggle()).toHaveAttribute("aria-expanded", "false");
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec vitest run --project web src/web/components/ReviewBar/ReviewBar.test.tsx src/web/components/App/App.test.tsx`

Expected: the new tests FAIL with `Unable to find an accessible element with the role "button" and name "Comments"`. Typecheck errors on the new `ReviewBar` props do not stop Vitest. The existing tests pass.

- [ ] **Step 4: Add the toggle to `ReviewBar`**

Replace `src/web/components/ReviewBar/ReviewBar.tsx` with:

```tsx
import { Badge, Button, Cluster } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./ReviewBar.module.css";

export interface ReviewBarProps {
  agentWaiting: boolean;
  draftCount: number;

  /**
   * Whether the comments panel is open, which matters only in a narrow window
   */
  isPanelOpen: boolean;

  /**
   * Called after the user submits their drafts
   */
  onSubmitted: () => void;

  /**
   * Called when the user asks to show or hide the comments panel
   */
  onTogglePanel: () => void;

  /**
   * The id of the comments panel
   */
  panelId: string;

  review: ReviewState;
}

/**
 * The bar beneath the comments: in a narrow window, a button that shows and hides them; then whether the agent is
 * listening, whether the review is approved, and the submit button
 */
export function ReviewBar({
  agentWaiting,
  draftCount,
  isPanelOpen,
  onSubmitted,
  onTogglePanel,
  panelId,
  review,
}: ReviewBarProps): JSX.Element {
  return (
    <section className={styles.reviewBar} aria-label="Review">
      <Button
        className={styles.panelToggle}
        onClick={onTogglePanel}
        variant="secondary"
        aria-controls={panelId}
        aria-expanded={isPanelOpen}
      >
        Comments
      </Button>
      <Cluster className={styles.status} gap={3}>
        <AgentStatus agentWaiting={agentWaiting} />
        {review.approved && (
          <Badge tone="success" variant="solid">
            Approved
          </Badge>
        )}
      </Cluster>
      <SubmitMenu draftCount={draftCount} onSubmitted={onSubmitted} />
    </section>
  );
}
```

Replace `src/web/components/ReviewBar/ReviewBar.module.css` with:

```css
.reviewBar {
  display: flex;
  flex-direction: column;
  gap: var(--sui-space-3);
  padding: var(--sui-space-3) var(--sui-space-4);
}

/* 48rem is App.module.css's breakpoint, below which the comments panel becomes a drawer */
@media (width >= 48rem) {
  /* Two classes, to outrank the display that StylesUI's Button sets */
  .reviewBar .panelToggle {
    display: none;
  }
}

@media (width < 48rem) {
  .reviewBar {
    align-items: center;
    flex-direction: row;
  }

  .status {
    flex-grow: 1;
  }
}
```

- [ ] **Step 5: Own the panel's open state in `App`, and make it a drawer when narrow**

In `src/web/components/App/App.tsx`:

Add the `clsx` import after the StylesUI import:

```tsx
import { PageLayout, Theme } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
```

Add the panel id after `unrequestedReview`:

```tsx
const commentsPanelId = "comments-panel";
```

Add the state after the `newComment` state:

```tsx
  const [isPanelOpen, setIsPanelOpen] = useState(false);
```

Add these two functions directly before `return`:

```tsx
  const startComment = (comment: NewComment): void => {
    setNewComment(comment);
    setIsPanelOpen(true);
  };
  const selectThreadInDocument = (threadId: number): void => {
    selection.selectThread(threadId);
    setIsPanelOpen(true);
  };
```

In the `DocumentPane` element, replace `onComment={setNewComment}` with `onComment={startComment}` and `onSelectThread={selection.selectThread}` with `onSelectThread={selectThreadInDocument}`.

Replace the comments panel's opening tag:

```tsx
          <div className={clsx(styles.commentsPanel, { [styles.open ?? ""]: isPanelOpen })} id={commentsPanelId}>
```

Replace the `ReviewBar` element:

```tsx
            <ReviewBar
              agentWaiting={connection.agentWaiting}
              draftCount={countDrafts(allThreads)}
              isPanelOpen={isPanelOpen}
              onSubmitted={threads.refresh}
              onTogglePanel={() => setIsPanelOpen((isOpen) => !isOpen)}
              panelId={commentsPanelId}
              review={threads.snapshot?.review ?? unrequestedReview}
            />
```

Both changes land in one render, so the drawer is shown before the effects of the new comment form (focus) and the selected thread card (`scrollIntoView`) run.

Append to `src/web/components/App/App.module.css`:

```css
@media (width < 48rem) {
  .columns {
    grid-template-areas:
      "document"
      "review";
    grid-template-columns: minmax(0, 1fr);
  }

  /* The drawer shares the doc's cell and covers its right edge */
  .commentsPanel {
    background-color: var(--sui-color-background);
    box-shadow: var(--sui-shadow-sm);
    grid-area: document;
    inline-size: min(24rem, 100% - 3rem);
    justify-self: end;
    z-index: 2;
  }

  .commentsPanel:not(.open) {
    display: none;
  }

  .reviewBar {
    border-inline-start: none;
  }
}
```

`z-index: 2` keeps the drawer above the doc's Comment button, which has `z-index: 1`. A grid item takes a `z-index` without being positioned.

- [ ] **Step 6: Run the component tests to verify they pass**

Run: `pnpm exec vitest run --project web`

Expected: all tests PASS.

- [ ] **Step 7: Write the end-to-end tests for narrow windows**

In `src/e2e/testing/reviewTest.ts`, export the existing helper by changing `async function selectText(` to `export async function selectText(`.

In `src/e2e/layout.e2e.ts`, change the imports to:

```ts
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { plan, scrollDocumentToEnd, selectText, test, withParagraphs } from "./testing/reviewTest";

const narrowWindow = { height: 800, width: 700 };

const wideWindow = { height: 720, width: 1280 };
```

Add these tests after `"must keep Submit and its menu in full view when the comments outgrow their column"`:

```ts
test("must show the comments in a narrow window only when the user asks for them", async ({ page, review }) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  await expect(comments(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Submit (0)" })).toBeInViewport();

  await commentsToggle(page).click();
  await expect(comments(page)).toBeVisible();
  await commentsToggle(page).click();

  await expect(comments(page)).toBeHidden();
});

test("must open the comments at a new comment when the user starts one in a narrow window, and keep its text while they are hidden", async ({
  page,
  review,
}) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  const commentBox = page.getByRole("textbox", { exact: true, name: "Comment" });

  await selectText(page, "cache", "24h");
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await expect(commentBox).toBeFocused();
  await page.keyboard.type("Why 24h?");
  await commentsToggle(page).click();
  await expect(comments(page)).toBeHidden();
  await commentsToggle(page).click();

  await expect(commentBox).toHaveValue("Why 24h?");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("button", { name: "Submit (1)" })).toBeInViewport();
});

test("must keep the comments open when the window widens and narrows again", async ({ page, review }) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  await commentsToggle(page).click();

  await page.setViewportSize(wideWindow);
  await expect(commentsToggle(page)).toBeHidden();
  await expect(comments(page)).toBeVisible();
  await page.setViewportSize(narrowWindow);

  await expect(comments(page)).toBeVisible();
});
```

Add these helpers at the end of the file, after `documentScrollTop`:

```ts
function comments(page: Page): Locator {
  return page.getByRole("complementary", { name: "Comments" });
}

function commentsToggle(page: Page): Locator {
  return page.getByRole("button", { exact: true, name: "Comments" });
}
```

- [ ] **Step 8: Run the end-to-end tests to verify they pass**

Run: `pnpm test:e2e`

Expected: every test PASSES in Chromium and WebKit.

- [ ] **Step 9: Describe narrow windows in the design spec**

In `docs/superpowers/specs/2026-10-08-markdown-review-design.md`, section 10, add this subsection directly after the `### Review bar` subsection that Task 3 added:

```markdown
### Narrow windows

Below 48rem the sidebar becomes a drawer over the right of the document view. The review bar then runs along the foot of the page, with a **Comments** button that shows and hides the drawer. Starting a comment, or clicking a highlight or marker, opens the drawer. Closing it keeps any unsent text.
```

- [ ] **Step 10: Verify everything, then commit**

Run: `pnpm format && pnpm verify && pnpm test:e2e`

Expected: lint, format check, typecheck, all Vitest projects (`node`, `web`, `integration`) and every end-to-end test pass.

```bash
git add src/web/components/ReviewBar src/web/components/App src/e2e docs/superpowers/specs/2026-10-08-markdown-review-design.md
git commit -m "Turn the comments into a drawer the user opens from the review bar when the window is narrow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
