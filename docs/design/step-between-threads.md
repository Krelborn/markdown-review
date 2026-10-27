# Step to the next or previous thread

Idea 352f2bfgdv. Web only: no server, CLI or protocol change.

## Problem

In a second round of a long plan the reviewer goes thread by thread: read the agent's answer, check the passage, move on. Today "move on" means finding the next card in the sidebar (which lists by group, not by position in the doc) or scrolling to the next numbered marker, which in a long doc is screens away. On a 14-inch laptop the doc and the comments sit side by side, so every hop costs a hand-scroll in one column or both.

Evidence in the code:

- No navigation keys exist. The only global key handlers are `useIsAltKeyDown` and Escape in `useGutterDrag`.
- `ThreadMarkers` and the cards select a thread one at a time; nothing steps.
- `groupThreads` orders the sidebar as Drafts, Open, Outdated, Resolved, so walking the cards top to bottom does not follow the doc.
- The two halves of "show both" already exist. `revealThread` selects and scrolls the passage via `useRevealSelectedThread`, and `ThreadCard` runs `scrollIntoView({ block: "nearest" })` when it becomes selected. Selecting also bumps `selectionCount`, which `CommentsList` uses to mark the thread seen.

## Options

1. **Keys only.** Smallest. Invisible, no help for mouse users, and not reachable by screen-reader users, whose browse mode takes letter keys before the page sees them (issue #62).
2. **Keys plus header buttons, one fixed order and set (chosen).** A pair of buttons in the comments header and `j`/`k`, stepping through this doc's live threads in document order. Small, discoverable, reuses `revealThread`.
3. **Keys plus buttons with a filter control** (all, open, unread replies). Matches the idea's "optionally only". Costs a new control and persisted state. Unread is also unstable as a filter: visiting a thread marks it seen, so it drops out and "previous" can no longer return to it.

## Design

**Order.** Document order of this doc's threads: whole-doc threads first, then passages by `startOffset`. That is the `compareThreads` order in `groupThreads`, so extract a small exported `compareThreads` (or a `threadsInDocumentOrder(threads)`) and reuse it instead of copying the sort. Review-level threads are not in the doc and are not stepped to.

**Which threads.** Default: drafts and open threads on the doc; skip resolved and outdated ones. Resolved are done, and outdated have no passage to show. The reader still reaches them by clicking, and a step from a selected resolved thread moves to the nearest eligible thread in the stated direction, found by position in the full ordered list. Whole-doc threads are included: a step selects the card and there is no passage to scroll. Check that `useRevealSelectedThread` does nothing harmful when it finds no range. An "unread replies only" filter is a later follow-up, for the reason in option 3.

**Ends and no selection.** Stop at the ends: the button goes `aria-disabled` (not `disabled`, so focus is not lost mid-sequence) and the key does nothing. Wrapping hides that the reader has finished. With nothing selected, next goes to the first and previous to the last. If the selection is on another doc's thread, treat it as nothing selected.

**Code.**

- `src/web/review/stepThread.ts`: pure `stepThread(documentThreads, selectedThreadId, direction): Thread | null`, plus `canStep` for the disabled state. Unit tested.
- `src/web/review/useStepKeys.ts`: one `keydown` listener on `window`, in the style of `useIsAltKeyDown`. Calls `onStep("next" | "previous")` for plain `j`/`k` (`j` next, `k` previous, as in vim and mail clients). It ignores the event when:
  - `ctrl`, `meta`, `alt` or `shift` is held, `repeat` is true, or `defaultPrevented` is set;
  - the target is an `input`, `textarea`, `select` or `contenteditable`, which covers the comment form and every text field;
  - the target is inside `[role="dialog"]`, `[role="menu"]`, `[role="listbox"]` or `[popover]`, which covers the new-comment menu, the submit, appearance and about popovers, and the document switcher. Verify the actual roles StylesUI renders.
- `App.tsx`: owns `documentThreads` and `selection`, so it builds the step handler: `selection.revealThread(next)`. Unlike `showThreadInDocument` it does not call `closePanel`, so the panel stays open on a wide screen.
- `CommentsHeader.tsx` gets `onStep` and the two states, and renders two `IconButton`s (up and down chevrons) in `actions` before `NewCommentMenu`. They are labelled "Previous thread" and "Next thread", with `aria-keyshortcuts="k"` / `"j"`, and a visible tooltip that names the key. They are real buttons, so they are in the tab order and work with Enter and Space. `ThreadSidebar` passes the props through. The buttons show only when the doc has threads.
- Announcement: after a step, the focused element does not change, so add a visually hidden `aria-live="polite"` line in the header ("Thread 3 of 12, open"). It is cheap and keeps screen-reader users oriented. Cut it if it feels heavy.

**Narrow screens.** The comments are a slide-over panel there. The buttons sit in the panel header, which would hide the doc they scroll. In a narrow window a step closes the panel, as clicking a card location does, so the passage shows; the keys then work with the panel closed. Reaching the buttons again means reopening the panel. This is the weakest part of the design; if it annoys, the follow-up is to put the pair in `ReviewBar`, which is always visible. Matt: say if you want that now.

**Learning the keys.** Tooltips and `aria-keyshortcuts` on the buttons, a line in the About popover, and a line in the README and `site/docs.html` usage (change both together, per AGENTS.md). No first-run hint.

**Fit with "changes since last submit" (PR #108).** That feature will want to step through changed passages, which is a different set (changed blocks, not threads) and may want its own keys. Both are "step through an ordered list of things in the doc". Keep `stepThread` generic over the list and keep the header button pair a presentational component taking `onStep`, `canStepPrevious`, `canStepNext` and a label noun. Do not share one control that changes meaning by mode, and do not design the changes stepper here. Decide the keys together when that design lands, so they do not clash.

## Risks

- **Key clashes.** `j`/`k` do nothing in browsers, but screen readers in browse mode (NVDA, JAWS) take letters first, so the keys may never arrive there. The buttons are the accessible path, which is why they are not optional. Watch for a bug report that a key fires while typing: the guard tests cover inputs, contenteditable and popovers.
- **Scroll fighting.** `revealThread` scrolls the doc, and the card scrolls itself with `block: "nearest"`. A fast key repeat could queue scrolls; ignoring `repeat` limits this. Check by holding `j` in a doc with 30 threads.
- **Layout shifting before the scroll.** Highlights lay out after render (issue #66). If the passage scrolls before layout settles, it may land short. Check on a long doc.
- **Re-selecting the same thread** does not rescroll the card (`ThreadCard` depends on `isSelected`), but the doc does rescroll, since `revealCount` changes. Acceptable.

## Done when

- `pnpm verify` passes, with unit tests for `stepThread` (order, skipping resolved and outdated, ends, no selection, selection on a resolved or other-doc thread) and `useStepKeys` (fires on `j`/`k`; ignored in a textarea, in the comment form, with a modifier, and inside an open popover or menu).
- In a doc with at least 10 threads, pressing `j` repeatedly selects each thread in the order its passage appears, the passage and its card are both in view after each press, and the last press does nothing. `k` goes back.
- With nothing selected, `j` selects the first thread and `k` the last.
- The buttons are tab-reachable, announce their label and shortcut, and show as disabled at the ends. Typing `j` in the comment form types a `j`.
- At a narrow width a button step closes the panel and shows the passage.
- A Playwright test in `src/e2e/` steps through a doc by key and by button.
