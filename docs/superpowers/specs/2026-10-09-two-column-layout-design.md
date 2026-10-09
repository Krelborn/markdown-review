# Two-column layout: design spec

- **Date:** 2026-10-09
- **Status:** Design approved in conversation (2026-10-09), ready for spec review
- **Changes:** section 10 (Browser UI) of the [design spec](2026-10-08-markdown-review-design.md)

## 1. Problem

1. Submit and the agent status are in the top bar, which scrolls away with the doc. To submit, or to see whether the agent is still waiting, the user has to scroll back to the top. The "Lost the connection to the review server" alert sits at the top of the doc column, so it scrolls away too.
2. The window scrolls the doc, and the sticky comments column scrolls itself. Their two scrollbars sit side by side at the right edge of the window, which makes both hard to use.

## 2. Intent and success criteria

**Intent:** whatever the user has scrolled, they can submit and can see whether the agent is listening and whether the server is connected. The doc and the comments each scroll on their own, under a header that stays put.

**Success looks like:**

1. After the user scrolls a long doc to its end, Submit and the agent status are in the viewport, and the window has not scrolled.
2. The doc's scrollbar and the comments' scrollbar never sit next to each other.
3. In a window about half a laptop screen wide (700px), the doc takes the full width, the comments open in a drawer, and Submit stays in view.
4. The behaviours that depend on scrolling still hold:
   - Clicking a thread's location scrolls its passage into view.
   - A heading named in the address is scrolled to.
   - A live edit keeps the user's place.
   - Unsent replies survive.

## 3. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| What scrolls | The doc column and the thread list each scroll; the window never does | Keep the window scrolling the doc | One scrollbar per column, each at its own column's edge; the header stays in view |
| Submit and agent status | A review bar at the foot of the comments panel | Keep them in the header; a toolbar at the top of the panel | Submit comes after the drafts it sends, in reading order. One bar serves both layouts. The header gets room for long doc paths |
| Narrow windows | The comments panel collapses into a drawer over the doc | Shrink the panel, then stack; always two columns; stack as today | Chosen by the user. Gives the doc the full width at half-screen sizes |
| Page alerts | A full-width strip under the header | Inside the review bar | Outside both scrollers, so it is visible at every width, even with the drawer closed |
| Breakpoint | 48rem (768px) | Today's stacking point, about 50rem | The panel shrinks to 18rem first, which leaves the doc 30rem at the breakpoint |

## 4. Layout

### Wide (48rem and wider)

```text
+--------------------------------------------------------------------+
| Markdown Review   docs/plan.md   Docs v                            |  header
+--------------------------------------------------------------------+
| ! Lost the connection to the review server ...                     |  page alerts, only when there are any
+--------------------------------------------+-----------------------+
|                                          | | Comment on the review | |
|  doc column (<main>)                     | | This doc | All docs   | |
|  scrolls                                 | | Drafts (2)            | |
|                                          | | ...                   | |  thread list scrolls
|                                          | +-----------------------+
|                                          | | o Agent waiting       |
|                                          | | [     Submit (2)    ] |  review bar
+--------------------------------------------+-----------------------+
```

The comments column is `clamp(18rem, 30vw, 24rem)` wide. The doc column takes the rest.

### Narrow (below 48rem)

```text
+------------------------------------------+
| docs/plan.md   Docs v                    |  header
+------------------------------------------+
|                     +--------------------+
|  doc column         | drawer, when open: |
|  scrolls            | the thread list,   |
|                     | which scrolls      |
|                     +--------------------+
+------------------------------------------+
| [Comments]  o Agent waiting  [Submit (2)] |  review bar
+------------------------------------------+
```

The drawer is `min(24rem, 100% - 3rem)` wide, sits over the right of the doc column, and has a background and a shadow. It has no backdrop and traps nothing, so the user can keep reading and selecting text in the doc while it is open.

### Structure

- `PageLayout` remains the shell, with a class that fixes its height to `100dvh`. Its rows are `TopBar`, the page alerts (rendered only when there are any) and the columns.
- The columns are a CSS grid that replaces the StylesUI `Sidebar`, so they never wrap. In order, they contain:
  - the doc column, a `<main>` holding `DocumentsPage` or `DocumentPane`
  - the threads column, which holds `ThreadSidebar` (its `<aside aria-label="Comments">`)
  - `ReviewBar`
- Nothing outside the doc column and the thread list scrolls. `overflow: hidden` still lets `scrollIntoView` scroll an element, which would push the header off screen, so no ancestor of the two scrollers may use it. Instead:
  - grid tracks are `minmax(0, …)`, so nothing overflows
  - the columns container has `min-block-size: 0`
  - `overflow: clip` is used wherever clipping is needed

A sketch of the grid, not the final CSS:

```css
.columns {
  display: grid;
  grid-template-areas:
    "document threads"
    "document review";
  grid-template-columns: minmax(0, 1fr) clamp(18rem, 30vw, 24rem);
  grid-template-rows: minmax(0, 1fr) auto;
  min-block-size: 0;
}

@media (width < 48rem) {
  .columns {
    grid-template-areas:
      "document"
      "review";
    grid-template-columns: minmax(0, 1fr);
  }

  /* The drawer shares the doc's cell and sits over its right edge */
  .threads {
    grid-area: document;
    inline-size: min(24rem, 100% - 3rem);
    justify-self: end;
  }
}
```

## 5. Components

### TopBar

Keeps the app link, the doc path and the Docs menu. Loses `AgentStatus`, the Approved badge and `SubmitMenu`, along with the `agentWaiting`, `draftCount`, `onSubmitted` and `review` props. Its doc comment changes to match.

### ReviewBar (new, `src/web/components/ReviewBar/`)

A region labelled "Review" holding, in order:

- **A Comments toggle**, shown only in the narrow layout. It sets `aria-expanded` from the panel's open state and `aria-controls` to the threads column's id.
- **`AgentStatus`**, unchanged.
- **The Approved badge**, while the review is approved.
- **`SubmitMenu`**, with its popover placement changed from `"bottom"` to `"top"`.

In the wide layout the toggle is hidden, the status and badge share a row, and Submit runs full width beneath them. In the narrow layout everything sits on one row, and the status text wraps when it has to.

### App

- Renders the shell from section 4.
- Moves the "Lost the connection" and "Some comments could not be read" alerts, unchanged, from the doc column into the page alerts strip.
- Holds `isPanelOpen`, false at first. Only the narrow layout's CSS reads it.
- Opens the panel when the user starts a comment (`onComment`) and when they select a thread from the doc (a highlight or a marker). It closes the panel when they click a thread's location in the panel.
- Holds a ref to the doc column and passes it to `usePageLocation`.

## 6. Narrow layout behaviour

- **Opening.** The drawer opens from the Comments toggle, or by itself when the user starts a comment (selection Comment, block +, Comment on this doc) or clicks a highlight or marker. Both changes land in one render, so the new comment form takes focus and the selected thread's card scrolls into view as they do now.
- **Closing.** The drawer closes from the toggle, and when the user clicks a thread's location. At narrow widths the drawer covers most of each line, so closing it is what lets the passage that scrolls into view be seen.
- **Staying mounted.** A closed drawer is hidden with CSS, not unmounted. `ThreadSidebar` keeps unsent replies and draft edits in its own state, and they must survive the drawer closing, just as they survive a thread moving group (commit 4a436ec).
- **Resizing.** Crossing the breakpoint keeps `isPanelOpen` as it was; it simply has no effect in the wide layout.

## 7. Scrolling behaviour

- **Navigate.** `usePageLocation.navigate` sets the doc column's `scrollTop` to 0 instead of calling `scrollTo(0, 0)` on the window. It still does so synchronously in `navigate`, so `useScrollToHeading`'s effect runs afterwards and a heading named in the new address still wins.
- **Reveal.** `useRevealSelectedThread` counts a passage as on screen when its box lies within the box of its nearest scrolling ancestor, which is the doc column, rather than between 0 and `innerHeight`. With no scrolling ancestor it falls back to the viewport. Like today, the check is vertical only. It finds the ancestor itself rather than taking the doc column's ref as a prop, because `DocumentView` is at fallow's cognitive-complexity limit and one more prop would exceed it.
- **Unchanged.** `scrollToHeading`, the reveal's `scrollIntoView({ block: "center" })` and `ThreadCard`'s `scrollIntoView({ block: "nearest" })` already scroll their nearest scroll container, so they need no change once nothing above the two scrollers can scroll.
- **Live edits.** The doc column lives in `App`, so it persists when the doc re-renders after an edit, and the user keeps their place as now.
- **Keyboard.** The lint config enforces `jsx-a11y/no-noninteractive-tabindex`, so the doc column does not get a `tabIndex`. Keyboard users reach it through its links and controls. Space and Page Down scroll the doc once the user has clicked or tabbed into it, but no longer on a freshly opened page.
- **Test stand-ins.** `src/web/testing/standInForLayout.ts` stubs `globalThis.scrollTo`. Remove the stub if nothing calls the window's `scrollTo` any more.

## 8. Testing

### Component tests (`web` project, jsdom)

- **Moved tests.** The status, Approved and submit tests move from `TopBar.test.tsx` to `ReviewBar.test.tsx`: agent waiting, not listening, approved, approve-only with no drafts, request changes, approve, and a refused submit. `TopBar.test.tsx` keeps the path and Docs menu tests.
- **Toggle.** `ReviewBar.test.tsx` adds that the toggle reports the panel's state through `aria-expanded` and asks to toggle it when pressed.
- **Opening the panel.** `App.test.tsx` adds that starting a comment opens the panel, and that clicking a thread's marker opens it.
- **Unchanged App tests.** The App tests for agent status, the draft count and the connection alert find their elements by role and text, so they should pass without change.
- jsdom has no layout, so the tests above cannot check the layout itself; the end-to-end tests do that.

### End-to-end tests (Playwright, Chromium and WebKit)

- **Existing test.** "must scroll the selected thread's passage back into view each time the user clicks its location" scrolls `main` to its end instead of the window.
- **New: wide layout.** In a long doc, after scrolling `main` to its end:
  - Submit and the agent status are in the viewport.
  - `window.scrollY` is 0.
  - The header is in the viewport.
- **New: narrow layout.** At 700px wide:
  - The comments are hidden until the user presses Comments.
  - Selecting text and pressing Comment opens the drawer with focus in the new comment's box.
  - Submit stays in the viewport.
  - A draft typed into the drawer is still there after the drawer is closed and opened again.

## 9. Docs to update

- **Design spec, [section 10](2026-10-08-markdown-review-design.md#10-browser-ui).**
  - The layout line becomes: header, page alerts, then the doc column beside the comments panel and review bar.
  - The "Top bar" list keeps the doc path and Docs menu. The agent status, Approved badge and Submit move to a new "Review bar" list.
  - Add the narrow layout.
- **README.**
  - "click **Submit** in the top bar" becomes "click **Submit** at the foot of the comments panel".
  - "The top bar shows whether the agent is waiting for you" becomes "The bar beneath the comments shows whether the agent is waiting for you".

## 10. Out of scope

- A count or a "new reply" marker on the Comments toggle.
- Restoring the doc column's scroll position on back and forward. `navigate` already resets it to the top.
- Closing the drawer with Escape.
