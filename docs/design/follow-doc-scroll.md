# Comments column follows the part of the doc being read

Idea kl01wa1h9a.

## Problem

The doc and the comments scroll separately (`App.module.css`: `.documentColumn` and `.commentsPanel` are both `overflow-y: auto`). A reviewer in section 6 of a long plan sees the comments wherever they were last left, usually the top. In a second round, when every thread holds an agent answer to read beside its passage, they click the highlight or marker, or hunt through the cards by hand. On a 14-inch laptop that is constant back-and-forth.

Evidence in the code: a card scrolls itself only when selected (`ThreadCard.tsx:58-62`, `scrollIntoView({ block: "nearest" })`). Nothing in `src/web` ties the two scrolls together.

## Options

1. **Mark only.** Cards whose passages are on screen get a subtle accent. No scrolling. Cheapest and cannot fight anything, but the card can still be off screen, which is the original complaint.
2. **Mark and follow (chosen).** Mark the in-view cards, and also scroll the comments so the first of them is visible, unless the user is busy. Costs a pause rule and a toggle. Risk: surprise scrolling, handled below.
3. **Align cards beside passages, Google Docs style.** Rejected. Cards need absolute positions, collision pushing, and a pass whenever a card changes height (typing, replies, folding). It cannot keep the Drafts/Open/Outdated/Resolved groups, and whole-doc, review and outdated threads have no passage to sit beside. ProseMirror's forum calls it awkward to build, and it replaces the grouped list that Matt's reviewers use for triage.

## Design

Ship option 2 as two layers: marking always on, scrolling behind a visible toggle. Marking alone is a worthwhile first PR.

### Which threads are being read

Rule: **a thread is in view when its passage start is inside the doc column's visible area.** The *followed* thread is the topmost in-view one. Nothing else counts:

- Whole-doc and whole-review threads, and outdated threads, have no passage: never marked, never followed. When the doc is scrolled to the very top, the followed target is the top of the list, so the whole-doc threads (which sort first) come into view.
- Drafts and Open threads with passages are eligible. Their groups are separate, so the target is the first in-view card of the group that is topmost on screen of the column: Drafts first, then Open. Marks apply in both.
- Resolved: marked and followed only while the Resolved group is expanded. A folded group is left alone; following never expands it.
- If no passage starts in view (a long passage spanning the screen), nothing changes. Using starts only matches the data that exists: markers carry the start, not the end. Passage ends can be added later if this proves too sparse.
- Only the current doc's threads can be in view; in the whole-review list other docs' cards are never marked.

### Where the computation lives

`useThreadHighlights` already returns `markers`, sorted by `top`, relative to the view and so unchanged by scrolling. It re-measures only on layout revision, not on scroll. Following reads them and adds no observer and no layout walk per thread.

- New `useReadingThreads(scrollerRef, viewRef, markers)` in `components/DocumentView/`. One passive `scroll` listener on `.documentColumn`, throttled with `requestAnimationFrame`. Per frame: two `getBoundingClientRect` reads (scroller and view), then a binary search of the sorted markers for the visible window. Result: `{ inViewIds: ReadonlySet<number>, topmostId: number | null }`, updated only when it changes. It also re-runs when `markers` changes, which covers resize and re-render.
- A `ReadingThreadsContext` (like `HoveredThreadContext`) carries it from `DocumentView` to the sidebar, since the two are siblings under `App`.
- `ThreadCard` takes `isInView` and sets `data-in-view` for CSS. No `aria-live`, no change to the accessibility tree.
- A `useFollowReading` hook in `components/ThreadSidebar/`, used by `CommentsList`, owns the scroll of `.commentsPanel` and the pause rules. Cards are found by a `data-thread-id` attribute through one query, not per-card effects.

**#66.** This adds a consumer of the single markers list and a single scroll listener; it creates no ResizeObserver. If #66 folds the seven observers into one shared layout measurement, `useReadingThreads` takes `markers` from that and nothing else changes.

### Who controls the scroll

Following does not scroll the comments while any of these hold:

- A composer or reply is open (`editor.newComment !== null` or `editor.editingThreadId !== null`), or keyboard focus is inside `.commentsPanel`.
- A card is selected (including through stepping, 352f2bfgdv), since selection already scrolls its own card. The pause ends when the selection is cleared, or when the user scrolls the doc by hand (wheel, touch or keys on the doc column), which signals they went back to reading.
- The user scrolled the comments by hand in the last 4 seconds. Hand scrolling is detected from `wheel`, `touchmove`, `pointerdown` on the scrollbar and navigation keys on the panel, not from `scroll` events, so our own scrolling never counts as the user's.

Following resumes by itself when these end, at the next doc scroll or after the 4 seconds. It never scrolls retroactively without a doc scroll.

**Visible control:** a "Follow doc" toggle button (`aria-pressed`) in `CommentsHeader`, on by default and kept per browser alongside the other view settings. Off disables scrolling only; marking stays, because it is passive. A hand scroll pauses without changing the toggle, so the toggle states the user's choice and not a transient state.

### Motion

- Act when the scroll settles (about 150 ms after the last doc scroll event), and only when the followed thread changes. Passages close together therefore give one move, not one per passage, and a thread that stays topmost causes none.
- Scroll only if the target card is not already fully visible in the panel, aligning its top to the panel under the sticky header (the panel's `scroll-padding-block-start` already accounts for it). Use `panel.scrollTo`; avoid `scrollIntoView`, which can also scroll ancestors.
- `behavior: "smooth"`, or `"auto"` (a jump) when `prefers-reduced-motion: reduce` matches. The same media query turns off any CSS transition on the mark.

### Accessibility (#62)

Nothing is announced on scroll: no live region, no role or label changes per scroll. Focus is never moved, and the pause rule above also stops any scroll while focus is in the panel. The mark is visual, with a text-free style (a left accent border meeting contrast needs in light and dark).

### Fit with the other designs

- **Thread stepping (352f2bfgdv):** stepping selects a thread, which selects its card and scrolls the doc. Selection pauses following, so the card's own `scrollIntoView` wins and the doc scroll does not trigger a second move. Marking still updates.
- **Changes since last submit (6mj47rcm4r, #108):** it scrolls the doc to changed text and sets no selection. Following treats that as reading and scrolls the comments to match, which is wanted. It needs nothing from that feature; if it ever scrolls in a way the user should keep control of, it can select the thread.
- No shared lock is added. The rule is: selection owns both scrolls; with nothing selected the doc owns the comments' position.

No server, CLI or protocol change is involved; the web app's existing layout data is enough.

## Risks

- **Surprise scrolling while reading a card:** the 4-second hand-scroll pause and the toggle limit this. Early signal: the toggle gets turned off in manual use.
- **Hover or pointer reading in the panel without scrolling it** (mouse resting over a card) is not covered by the pause. If it annoys, add `pointerenter` to the pause.
- **Passage starts too sparse** in docs with long passages: the column stays put. Watch for it while testing on a real plan; add ends to the markers if needed.
- **Hand-scroll detection differs by input** (trackpad inertia, scrollbar drag). Test in Chromium and WebKit (`pnpm test:e2e`).
- **Frame cost:** two rect reads and a binary search per frame is small; `pnpm exec fallow health` should show no hotspot.

## Done when

- `pnpm verify` and `pnpm test:e2e` pass.
- Unit test: given sorted markers and a window, `useReadingThreads` returns the in-view ids and the topmost one, and an unchanged result gives no state update.
- Component test: with a card selected, an open composer or focus in the panel, a doc scroll does not move `.commentsPanel`; with none of them it does, once per change of topmost thread.
- E2E: in a long doc with a dozen threads, scrolling the doc brings the matching Open card into the panel; scrolling the comments by hand, then the doc, within 4 seconds leaves the comments alone; turning the toggle off stops all moves while the marks remain.
- With `prefers-reduced-motion: reduce` emulated, the comments jump instead of animating.
- By hand: a screen reader reads nothing while the doc scrolls, and the focused element is the same before and after.
