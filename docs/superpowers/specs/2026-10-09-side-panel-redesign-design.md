# Side panel redesign: design spec

- **Date:** 2026-10-09
- **Status:** Design approved in conversation (2026-10-09), ready for spec review
- **Changes:** section 10 (Browser UI) of the [design spec](2026-10-08-markdown-review-design.md), and the review bar from the [two-column layout spec](2026-10-09-two-column-layout-design.md)
- **Follow-up:** approving a single doc is a separate spec. It changes the store, the HTTP API, the CLI's output and the protocol. This spec changes none of them.

## 1. Problem

Version 0.1.0 works, but the comments panel is clumsy. Reviewing it in the browser with a sample review showed these problems:

1. **Several editors at once.** The whole-review box is always open. Every draft is a live text box, and a reply opens another. Three editors can be on screen together, each with its own save button, two of them disabled.
2. **Inconsistent labels and order.** The same action is called "Save draft", "Add comment" and "Save reply". Buttons sit on the left, with Cancel after Save.
3. **Doc comments are hard to find.** They exist, but the only way to start one is a ghost "Comment on this doc" button above the doc's title, which reads as stray text.
4. **Drafts look like forms.** Nothing tells a draft from a sent comment except its group, and grey cards, grey fields and grey buttons give the eye no hierarchy.
5. **The filter takes space for nothing.** "Show comments on" takes two rows, even when no other doc has threads and both choices list the same threads.
6. **The passage disappears.** The selection is cleared when the user starts a comment, so the passage they are writing about is no longer highlighted.
7. **Submit says too little.** Submit is a full-width primary button even with no drafts. Its menu sends every draft in the repo without saying which docs they are on, so stale drafts on other docs go out unseen.
8. **The doc column looks unfinished.**
   - The prose runs from the left edge, and markers sit at the far right of the column, hundreds of pixels from the text they mark.
   - Code blocks have no background in light mode.
   - The Docs menu in the top bar doesn't look clickable.

## 2. Intent and success criteria

**Intent:** the panel reads like a professional review tool. There is one editor at a time, every way of commenting can be found from the panel, and drafts read as comments that haven't been sent yet.

**Success looks like:**

1. At most one comment editor is open on the page at any time.
2. Starting another comment never silently loses text the user has typed.
3. Every editor has the same buttons in the same places: Cancel then Save, on the right. Editing a draft adds Discard on the left.
4. A user can start a comment on the doc or on the whole review from the panel header without being told how.
5. A draft reads as text with a Draft badge, and its text box appears only after the user presses Edit.
6. The filter appears only when it changes which threads are listed.
7. Before submitting, the user can see how many drafts will be sent and which docs they are on.
8. The passage being commented on stays highlighted while the user writes.

## 3. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Save label | **Save** on every editor | Queue; Save draft; Add comment | Fits new comments, replies and draft edits alike, and pairs with Cancel. The Draft badge, the Drafts group and the count on Submit say the comment hasn't been sent |
| Button order | Right-aligned, Cancel then Save; Discard alone on the left | Left-aligned, Save first | Mac order, chosen by the user. Keeping Discard apart from Save guards against a slip |
| Secondary buttons | Cancel, Discard and Keep editing use the `outline` variant | `ghost` | Chosen by the user |
| Editors | One at a time | Several | Chosen by the user |
| Unsaved text | The editor that holds it asks, inline, whether to save it or discard it | A modal sheet | The question appears beside the text it is about, works the same in the narrow-layout drawer, and needs no new Dialog component |
| Starting doc and review comments | A **+ Comment** menu in the panel header | The ghost button in the doc column; the review box that is always open | One place for the comments that have no passage to select |
| Drafts | Read-only, with Edit | A live text box | Chosen by the user |
| Filter | Underline tabs in the panel header, with counts, shown only when another doc has threads | A smaller segmented control; the title as a menu | Reads as two views of one list, costs no extra row, and the counts show what the other view holds |
| Submit | A popover listing the drafts by doc, a choice of verdict, then Submit | Two action buttons | Shows what is about to be sent. The follow-up spec adds a third verdict to the same list |
| Navigating with an editor open | The editor stays open, and its thread stays in view | Ask before navigating | The agent's `open` can navigate at any time, and back and forward can't be held |

## 4. Layout

```text
+-------------------------------------+
| Comments (5)          [+ Comment v] |  panel header, stays in view
+-------------------------------------+
| +---------------------------------+ |
| | New comment                     | |  composer, only while starting a comment
| | | cache results for 24h         | |
| | [text box                     ] | |
| | Cmd+Enter to save [Cancel][Save]| |
| +---------------------------------+ |
| DRAFTS (1)                          |
| +---------------------------------+ |
| | #5 Line 9               [Draft] | |
| | | measure the hit rate          | |
| | A week is not enough...         | |
| |                          [Edit] | |
| +---------------------------------+ |
| OPEN (3)                            |  the list scrolls
| ...                                 |
| > RESOLVED (1)                      |
+-------------------------------------+
| o Agent listening       [Submit 2]  |  review bar
+-------------------------------------+
```

When another doc has threads, the header's title becomes tabs:

```text
| This doc (5)  All docs (8)  [+ Comment v] |
```

- In the narrow layout the header also holds the **Hide comments** button, which replaces the drawer's separate header row.
- The review bar is one row at every width. In the narrow layout the **Comments** toggle comes first, as now.

## 5. Editors

### Kinds

| Editor | Opened by | Starts with | Buttons |
| --- | --- | --- | --- |
| New comment | **Comment** beside a selection, **+** beside a block, the **+ Comment** menu | Nothing | Cancel, Save |
| Reply | **Reply** on an open or resolved thread | Nothing | Cancel, Save |
| Draft | **Edit** on a draft comment or a draft reply | The saved draft | Discard; Cancel, Save |

- **Save** stays disabled while the text is blank or matches the saved draft, as now. A successful save closes the editor. A failed save shows the error in the editor and keeps the text.
- **Cancel** closes the editor at once and throws away the unsaved text. In a draft editor it leaves the saved draft as it was.
- **Discard** deletes the draft, as "Discard draft" does now: a draft comment's thread goes, and a draft reply leaves its thread. It does not ask first.

### Unsaved text

An editor holds **unsaved text** when:

- a new comment or reply has text that isn't blank, or
- a draft editor's text differs from the saved draft.

### One at a time

Any action in the "Opened by" column is a request for an editor. When one arrives:

- **No editor is open, or the open one holds no unsaved text:** the open editor closes and the new one opens.
- **The open editor holds unsaved text:** the request is put on hold, and the open editor asks what to do with its text. It scrolls into view, the drawer opens in the narrow layout, and focus moves to its Save button.
- **The request is for the editor that is already open:** focus moves to its text box, and nothing else changes.

Selecting a thread, by its highlight, its marker or its card, is not a request, so it never asks.

### The question

The editor shows a banner above its text, and swaps its buttons for three:

```text
+-------------------------------------------+
| Save this comment first?                  |
| You started a reply to #4.                |
+-------------------------------------------+
| ...the editor's text...                   |
| [Discard]          [Keep editing] [Save]  |
+-------------------------------------------+
```

- **Title.** "Save this comment first?" for a new comment or reply, and "Save your changes first?" for a draft.
- **Second line.** It names the request on hold: "You started another comment.", "You started a reply to #4." or "You started editing #5."
- **Save** saves the text. If that succeeds, the request on hold goes ahead. If it fails, the editor shows the error, keeps the text, and drops the request.
- **Discard**, or **Discard changes** in a draft editor, throws away the unsaved text, and then the request on hold goes ahead. A draft goes back to its saved text and is never deleted by this button.
- **Keep editing** drops the request and returns focus to the text box.
- A new request that arrives while the question is showing replaces the one on hold.

### Keyboard

- **Cmd+Enter**, or Ctrl+Enter outside macOS, saves when Save is enabled. A muted hint says so beside a new comment's buttons.
- **Escape** closes an editor that holds no unsaved text, as Cancel does. In an editor that does, it asks the question with nothing on hold, titled "Save this comment?" or "Save your changes?" and without a second line. Discard and Save then close the editor.
- **Escape while the question is showing** works as Keep editing.

### Leaving the page

While an editor holds unsaved text, closing or reloading the tab triggers the browser's own leave-page warning (`beforeunload`).

### Where the text lives

`App` holds the open editor and its text, so the text survives:

- the drawer closing
- its thread moving to another group
- a live update re-rendering its card
- navigation to another doc

With one editor there is only one text to keep, so this replaces `UnsentTextContext` and `useUnsentText`.

If the thread being edited disappears, or its draft is submitted or discarded in another tab, the editor closes.

### Navigation

Moving to another doc never closes the open editor and never asks. This covers links, the Docs menu, back and forward, and the agent's `open`. So that the editor is always on screen:

- the composer for a new comment stays at the top of the panel, with its doc's path as its location while that doc is not on screen
- the **This doc** view also lists the thread whose reply or draft is being edited, under its doc's path, wherever that thread is

### The passage being commented on

While a new comment on a passage or block of the doc on screen is open, the doc highlights its passage in the selected-thread colour (`--sui-color-primary-subtle`). The composer's quote has a bar in the same colour. Other quotes keep the warning colour.

## 6. Starting comments

- **Passage** and **block:** unchanged. A selection's **Comment** button and the **+** beside a hovered block request a new comment.
- **Doc** and **review:** the **+ Comment** button in the panel header opens a menu:
  - **On this doc**, with the doc's path beneath it
  - **On the whole review**, with "Every doc in this review" beneath it
- **On the docs list,** where only a review comment is possible, the button is **+ Review comment** and requests one directly.
- **The composer** sits at the top of the list, above the groups. It shows "New comment", the location ("Whole doc" or "Whole review"; a passage shows its quote instead) and the text box. Its text box is named for screen readers, for example "Comment on the whole review". Opening it scrolls the list to the top and focuses the text box.
- The ghost **Comment on this doc** button above the doc's title is removed.

## 7. Thread cards

- **Surface.** Cards sit on `--sui-color-background` with a `--sui-color-border` border, on a panel body of `--sui-color-surface`. The selected card keeps its primary bar on the inline start. Both light and dark modes must be checked.
- **Header.**
  - **On the left:** `#id` in a muted colour, then the location. For a passage or a doc, the location is a link-styled button that reveals the thread, as now. Its accessible name stays "#5 Line 9". "Whole review" is plain text.
  - **On the right:** badges for **Draft**, **New reply** (was "New"), **Outdated** and **Resolved**.
- **Group headings:** small, muted, uppercase labels with a count, such as "DRAFTS 1". Resolved stays folded.
- **A draft comment** shows its quote and its text, with **Edit** (`secondary`) on the right.
- **A thread with messages** lists each message with:
  - an `Avatar` (`xs`, with `aria-hidden`, since the name is printed beside it)
  - "You" or "Agent"
  - the time sent: "10:42" today, otherwise a short date such as "8 Oct", with the full date and time in its `title`

  A draft reply appears after the messages, below a divider, as a message marked with a Draft badge in place of its time.
- **Actions,** on the right:

  | Thread | Actions |
  | --- | --- |
  | Draft comment | Edit |
  | Open, no draft reply | Resolve (`outline`), Reply (`secondary`) |
  | Open, with a draft reply | Resolve, Edit |
  | Resolved, no draft reply | Reply |
  | Resolved, with a draft reply | Edit |

- **Editing.** An editor opened in a card replaces what it edits. A draft comment's editor replaces the comment's text, and a draft reply's editor replaces that message. A reply editor appears after the messages.

## 8. Panel header and filter

- **Title.** "Comments" with a count of the threads listed.
- **Tabs.** When any thread is on a doc other than the one on screen, StylesUI's underline `Tabs` replace the title: "This doc" and "All docs", each with a count of the threads it lists. Otherwise the tabs are hidden and the panel shows This doc. If the tabs hide while All docs is chosen, the panel goes back to This doc.
- **On the docs list** there are no tabs, and the panel lists every thread under its doc, as now.
- **Scrolling.** The header stays in view while the list scrolls.

## 9. Review bar and Submit

### Review bar

- **Layout.** One row: the agent status on the left, then the Approved badge while the review is approved, then **Submit**.
- **Submit button.** It shows the number of drafts as a `Counter` when there are any. It is `primary` when there are drafts and `secondary` when there are none, since Approve with no drafts is still allowed.

### The Submit popover

```text
Submit review
Sends 3 drafts: [plan.md 2] [Whole review 1]

(o) Request changes
    Send your comments and ask the agent to revise.
( ) Approve
    Send your comments and end the review.

o The agent is listening and will hear at once.
                               [Cancel] [Submit]
```

- **The drafts line.** It gives one chip per doc with drafts, showing the doc's file name (with its path in the chip's `title`) and how many drafts it has. A chip labelled "Whole review" counts review drafts. Draft replies count as drafts. With no drafts, the line reads "You have no drafts."
- **Verdicts.** A `RadioGroup` offers:
  - **Request changes,** disabled when there are no drafts
  - **Approve,** described as "End the review." when there are no drafts

  The first choice is Request changes when there are drafts, and Approve otherwise.
- **The agent line.** It keeps today's wording about whether the agent will hear at once.
- **Submitting.** **Submit** sends the chosen verdict and shows that it is busy until the server answers. It closes the popover when the submit succeeds, and shows the error when it fails, as now. **Cancel** closes the popover.
- **Unchanged.** Submit still sends every draft in the repo.

## 10. Doc column and top bar

- **Prose width.** The prose is centred at a reading width of `72ch`. The **+** gutter and the markers move with it, so markers sit just right of the text they mark.
- **Code blocks.** They get a visible surface in light mode, with a `--sui-color-border` border and `--sui-color-surface` behind the theme's background. Dark mode keeps its background. This changes only CSS, so the conformance test is unaffected.
- **Top bar.**
  - The path's folders are muted and its file name uses the text colour. The path still loses its start when it is too long.
  - The **Docs** trigger becomes a small `secondary` button with a chevron.

## 11. Components

| Component | Change |
| --- | --- |
| `App` | Holds the open editor, its text, the request on hold, and the question's state, in place of `newComment`. A hook such as `useCommentEditor` in `src/web/review/` owns the rules in section 5. Registers `beforeunload` while there is unsaved text. Passes the pending passage to the doc view |
| `ThreadSidebar` | Drops the always-open review box and the "Show comments on" control. Gains the panel header. Keeps the editor's thread in the This doc view |
| Panel header (new) | Title or tabs, the **+ Comment** menu or the **+ Review comment** button, and in the narrow layout the Hide comments button |
| `NewCommentForm` | The composer from section 6 |
| `CommentForm` | Right-aligned buttons in Mac order, `outline` secondary buttons, an optional left-hand slot (the hint or Discard), Cmd+Enter and Escape, and the question banner. Loses `clearOnSubmit` and `unsentTextKey` |
| `ThreadCard`, `ThreadActions` | Read-only drafts, message avatars and times, and the actions table from section 7 |
| `ThreadGroup` | The heading style from section 7 |
| `ReviewBar`, `SubmitMenu` | Section 9 |
| `DocumentView` | Loses the Comment on this doc button. Highlights the pending passage. Centres the prose |
| `TopBar`, `DocumentsMenu` | Section 10 |
| `UnsentTextContext`, `useUnsentText` | Removed |

## 12. Testing

### Component tests (`web` project, jsdom)

- **One editor.**
  - Starting a comment while a clean editor is open replaces it.
  - Starting one while an editor holds unsaved text asks the question. Then:
    - Save saves the text and opens the new editor.
    - Discard drops the text and opens the new editor.
    - Keep editing keeps the text and drops the request.
  - A failed save keeps the text and drops the request.
  - In a draft editor, Discard changes restores the saved draft without deleting it.
- **Buttons.** Each kind of editor has its buttons in the order from section 5. Save is disabled while the text is blank or unchanged.
- **Keyboard.**
  - Cmd+Enter and Ctrl+Enter save.
  - Escape closes a clean editor and asks in one with unsaved text.
- **Drafts.**
  - A draft shows its text and Edit, with no text box.
  - Edit opens the editor with the saved text, and Cancel restores the read-only view.
  - Discard deletes the draft.
  - A draft reply works the same way inside its thread.
- **+ Comment.**
  - The menu starts a comment on the doc or on the review.
  - On the docs list, **+ Review comment** starts a review comment.
- **Filter.**
  - The tabs are hidden when only this doc and the review have threads, and shown with counts when another doc has threads.
  - All docs falls back to This doc when the tabs hide.
- **Navigation.** The thread being edited stays listed after navigating to another doc, with its text.
- **Submit.**
  - The popover lists drafts by doc, picks the right first verdict, disables Request changes with no drafts, and submits the chosen verdict.
  - The review bar's Submit is `secondary` with no drafts.
- **Leaving the page.** `beforeunload` is prevented only while there is unsaved text.
- **Existing tests.** Tests that find "Save draft", "Add comment", "Save reply", "Discard draft", "Comment on the whole review", "Comment on this doc" or the "Show comments on" radios are updated to the new names.

### End-to-end tests (Playwright, Chromium and WebKit)

- **Existing tests** that use the old labels in `src/e2e/` are updated to the new ones.
- **New: one editor.**
  1. Select text, press Comment, and type.
  2. Select other text and press Comment.
  3. The first composer asks. Pressing Save leaves one draft saved and a new composer open.
- **New: the passage being commented on.** While a passage composer is open, the doc's pending highlight covers the passage (checked through `CSS.highlights`).
- **New: navigation.** A reply typed on one doc is still there, with its text, after going to another doc and back.

## 13. Docs to update

- **Design spec, [section 10](2026-10-08-markdown-review-design.md#10-browser-ui).**
  - "Writing comments": doc and review comments start from the + Comment menu, and the composer opens at the top of the panel.
  - "Review bar": one row. Submit opens a popover that lists drafts by doc and offers the verdicts.
  - "Sidebar":
    - the filter tabs and when they show
    - read-only drafts
    - one editor at a time and the question
    - message avatars and times
- **README,** "Comment on a doc" and "Comment on the whole review": both start from **+ Comment** at the top of the comments. Its description of the This doc / All docs toggle becomes the tabs, shown when other docs have comments.

## 14. Out of scope

- Approving a single doc. That is the follow-up spec, which also decides which drafts a submit sends.
- Any change to the protocol, the store, the HTTP API or the CLI.
- A Dialog component.
- Markdown in comments, and editing or deleting messages once sent.
- Keyboard shortcuts beyond Cmd+Enter and Escape in an editor.
