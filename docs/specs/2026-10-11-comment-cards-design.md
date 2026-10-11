# Comment cards: design spec

- **Date:** 2026-10-11
- **Status:** Approved in conversation (2026-10-11)
- **Changes:** the thread cards and the comment editor from the [side panel redesign spec](2026-10-09-side-panel-redesign-design.md), sections 5 and 7, and when its Resolved group is folded
- **Changes nothing in:** the store, the HTTP API, the CLI or the protocol. The canonical text does not change, so neither `anchoringVersion` nor `protocolVersion` changes.

## 1. Problem

The user reported four problems with the comment cards. A review of a sample spec in the browser, played through three rounds with the CLI as the agent and ending in Approve, confirmed all four and found more.

### Reported by the user

1. **Buttons change style for no reason.** A card's Edit and Reply are `secondary`, a grey fill, but its Resolve is `outline`, a blue outline. Opening the editor swaps Edit for Discard and Cancel, which are both `outline`, so the card's buttons turn from grey to blue. On an open thread the lesser action, Resolve, is the more prominent one.
2. **The editor's text is bigger than the text it replaces.** A draft reads at 14px (`sm`, on a 21px line) and its editor at 16px (`md`, on a 24px line). The text grows and reflows when the user presses Edit.
3. **A draft can only be discarded from its editor.** The user has to press Edit, then Discard, and Discard deletes the draft without asking.
4. **The avatars sit high.** Each message's avatar is 16px tall and top-aligned in a grid cell beside a name line 21px tall, so its centre is 2.5px above the name's. A draft reply's name line holds a Draft badge, which is 24px tall, so the offset grows to 4px.

### Found in the review

5. **The editor is too short for a draft.** It has three rows and does not grow. A draft of four lines or more opens with its end hidden behind a scrollbar. In the sample, 72px of a 196-character draft was out of view.
6. **The caret starts at the beginning of the draft.** Edit focuses the text box with the caret at offset 0, so text typed straight away goes in front of the draft.
7. **The agent's answers are folded away.** After a round in which the agent resolved every thread, the panel showed only "▸ Resolved 5". Five threads had new replies, and nothing outside the folded group said so. Checking what the agent did is the user's main task in that round.
8. **New reply stays after the user has dealt with the thread.** Only the location link in a card marks a thread's replies seen. Replying, resolving, editing, and selecting the thread by its highlight or its marker in the doc all leave the New reply badge on the card.
9. **Outdated is noise on a resolved thread.** The agent fixes a passage by rewriting it, so most resolved passage threads are also outdated. In the sample a card's header held three badges: New reply, Outdated and Resolved.
10. **Resolve and a draft reply contradict each other.** Resolve on a thread with a draft reply resolves it and keeps the draft, and sending the draft reopens it.
11. **Times have a leading zero on a 12-hour clock.** `formatMessageTime` asks for a 2-digit hour, which reads "04:27 PM" in `en-US`.
12. **A reply to a resolved thread reopens it without saying so.** The editor looks the same as any other reply.
13. **Focus is lost after Discard.** The card that held the focused button goes, and focus falls to the page's `<body>`.
14. **The empty-panel hint stays under the composer.** While the user writes the first comment, "No comments yet. Select text in the doc, or press + beside a block, to comment on it." still shows beneath it.

## 2. Assumptions

1. **Only desktop browsers reach the app.** The server listens on `127.0.0.1`, so a phone can't load it, and the zoom iOS Safari applies to text under 16px doesn't arise.
2. **Chromium and WebKit are the browsers that matter**, as the end-to-end tests run in them. Both support `field-sizing: content`. Any other browser keeps today's three-row editor and its resize handle.
3. **StylesUI stays at 0.6.0.** It has no danger button and no dialog, so everything here is built from its `Button` variants, `Popover`, `Badge` and `Textarea`.
4. **The server is unchanged.** It still accepts Resolve on a thread with a draft reply, from the API or a tab running older code. Hiding the button is a change in the browser only.
5. **Messages stay plain text.**
6. **One spec, not a capability map.** Every change is in the comments panel and ships as one feature. The plan slices it into tasks that can each be verified on their own.

## 3. Objective and success criteria

**Objective:** a card looks the same whether it is being read or edited, its buttons follow one rule, nothing the user wrote goes without them confirming it, and after each round the panel puts what the agent did in front of the user.

**Success looks like:**

1. **Buttons.** No button in the comments panel or the Submit popover is `outline`. Save and Submit are the only buttons that can be `primary`. Every other labelled button is `secondary`, the confirming Discard included. Icon buttons and menu items stay `ghost`.
2. **Editor text.** The editor's text box has the same computed font size and line height as the read-only text it replaces: 14px on a 21px line.
3. **Editor height.** The text box shows all of a five-line draft without scrolling. Past half the viewport's height it scrolls.
4. **Caret.** When an editor opens on a draft, the caret is at the end of the text. Keep editing, and asking for the open editor again, leave it where it was.
5. **Discard.** Every draft, read or being edited, has Discard as the first button in its row. Pressing it asks first. Only confirming deletes the draft. Cancel, Escape and a click outside keep the draft, and Cancel and Escape return focus to Discard.
6. **Resolve.** No card shows Resolve while its thread has a draft reply.
7. **Avatars.** Each avatar's centre is within 0.5px of its name line's centre, beside a time and beside a Draft badge.
8. **Resolved group.** When a resolved thread gets an agent message the user hasn't seen, the Resolved group opens. While folded, its heading shows how many of its threads have a new reply.
9. **Seen.** Selecting a thread by its card, its highlight or its marker clears its New reply badge, and so do Reply, Edit, Resolve and Discard on it.
10. **Badges.** A resolved thread never shows Outdated.
11. **Times.** Today's times read "4:27 PM" in `en-US` and "09:05" in `en-GB`.
12. **Reopening.** A reply editor on a resolved thread says that sending reopens it.
13. **Focus.** After a draft comment is discarded, focus is on the next card's location, or the previous card's when it was the last, or the **+ Comment** button when no card is left. After a draft reply is discarded, focus is on its card's Reply.
14. **Composer.** The empty-panel hint is hidden while the composer is open.
15. **Nothing else moves.** The conformance test passes unchanged, `anchoringVersion` and `protocolVersion` are unchanged, and `pnpm verify`, `pnpm build`, `pnpm test:e2e` and `fallow audit` pass.

## 4. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Button variants | `primary` for Save and Submit; `secondary` for every other labelled button | `outline` for every other button; `ghost` for the card's buttons | Chosen by the user, after comparing `secondary` and `outline` on the same cards. One rule in the card and its editor alike, so nothing changes colour when the editor opens. Grey keeps a list of cards calm, where blue outlines on every card compete with Submit. `ghost` buttons don't look pressable on the panel's surface. This reverses the side panel spec's choice of `outline` for the editor's buttons |
| Editor text | `Textarea size="sm"` | Keep `md`; a borderless text box with no padding, so the text doesn't move at all | `sm` matches the read-only text: 14px on a 21px line. The text box's padding and border narrow the line by 26px, so a long line may wrap a word sooner. A borderless box would stop looking like a field |
| Editor height | `field-sizing: content`, at least three lines and at most half the viewport | A script that sets the height from `scrollHeight`; more rows | CSS, no script, in both target browsers |
| Caret | At the end of the text when an editor opens on a draft | Select all; leave it at the start | Adding to a draft is the common edit. Selecting all makes a stray keypress wipe the draft |
| Discard placement | First in the row, on read-only drafts and in draft editors alike | Only in the editor, as now | The user asked for it on the read-only card. It stays where it is when the editor opens, apart from Edit and Save |
| Discard confirmation | A popover from the Discard button: "Discard this comment?" or "Discard this reply?", then Cancel and Discard | An inline banner that swaps the card's buttons, as the unsaved-text question does; an Undo after it | Chosen by the user that Discard asks first. A popover leaves the card as it is, closes on Escape and on a click outside, and is the pattern Submit already uses. StylesUI has no dialog |
| The confirming Discard's style | `secondary`, as Cancel is | `primary`; a `danger` button | Chosen by the user. StylesUI 0.6.0 has no `danger` variant. One will be added to StylesUI later, and the confirming Discard will use it then. Until then, `primary` would make a destructive action look like Save |
| Which Discards ask | The ones that delete a saved draft: on a read-only card, and in a draft editor | Also the unsaved-text question's Discard | The question's Discard is already an answer to a question, and leaves any saved draft as it was |
| Focus in the confirmation | Cancel | Discard | A destructive action shouldn't be the default, as Apple's HIG advises, so a stray Enter keeps the draft |
| Resolve with a draft reply | Hidden | Shown, as now; sending the reply as Resolve happens | Chosen by the user. Resolve means nothing more is needed, and a draft reply is something more. The user discards a draft they don't want |
| Focus after Discard | The next card's location; the previous card's when it was the last; **+ Comment** when none is left. A draft reply's card keeps focus on its Reply | Leave it to the browser | A keyboard user keeps their place in the list |
| Avatar alignment | A grid with the avatar and the name line in one row, centred, and the body under the name | A top margin on the avatar of half the difference in height | Stays centred whatever the row holds: a time, or a Draft badge |
| Resolved group | Opens by itself whenever the number of its threads with a new reply rises. While folded, its heading carries an `info` badge such as "3 new replies" | A separate "To check" group above it; leave it folded | Keeps the groups the user knows, and shows the agent's answers when they matter. The user can still fold it |
| Seen | Selecting a thread, by its card, its highlight or its marker, marks its messages seen, and so do Reply, Edit, Resolve and Discard on it | Only the location link, as now | Each of these shows the user the thread. A badge that outlives them stops meaning anything |
| Outdated badge | On open threads only | On every thread, as now | On a resolved thread it almost always means the agent changed the passage, which Resolved already says |
| Times | No leading zero on a 12-hour clock ("4:27 PM"); 2-digit hours on a 24-hour clock ("09:05") | `hour: "numeric"` everywhere | `numeric` would turn `en-GB`'s "09:05" into "9:05" |
| Reply to a resolved thread | "Sending reopens this thread." in muted text at the start of the editor's buttons | No hint | The same place as a new comment's shortcut hint |

## 5. Layout

A draft comment, read and being edited. Discard stays in place, and the text keeps its size:

```text
+---------------------------------+      +---------------------------------+
| #8 Line 71              [Draft] |      | #8 Line 71              [Draft] |
| | Turn on for the Free plan.    |      | | Turn on for the Free plan.    |
| How long between steps 2 and 3? |      | +-----------------------------+ |
| I'd hold Free for at least a    |      | | How long between steps 2    | |
| week...                         |      | | and 3? I'd hold Free for at | |
|                                 |      | | least a week...             | |
| [Discard]                [Edit] |      | +-----------------------------+ |
+---------------------------------+      | [Discard]      [Cancel] [Save] |
                                         +---------------------------------+
```

The confirmation, opened from either Discard:

```text
+-------------------------------------+
| Discard this comment?               |
| It hasn't been sent, and you can't  |
| get it back.                        |
|                  [Cancel] [Discard] |
+-------------------------------------+
  [Discard]                    [Edit]
```

A thread with a draft reply. Each avatar is centred on its name line, and Resolve is gone until the draft is sent or discarded:

```text
+---------------------------------+
| #7 Line 70          [New reply] |
| | Ship in shadow mode: count... |
| (A) Agent  4:28 PM              |
|     Would 'fewer than 0.1% of   |
|     requests rejected' work?    |
| ------------------------------- |
| (Y) You  [Draft]                |
|     Yes, over 7 days.           |
| [Discard]                [Edit] |
+---------------------------------+
```

The Resolved group, folded, after the agent has answered:

```text
> RESOLVED 5   [3 new replies]
```

## 6. Behaviour

### Buttons

| Card | Buttons, start then end |
| --- | --- |
| Draft comment | Discard; Edit |
| Open, no draft reply | Resolve, Reply |
| Open or resolved, with a draft reply | Discard; Edit |
| Resolved, no draft reply | Reply |
| An editor on a draft | Discard; Cancel, Save |
| A new comment or reply editor | its hint, if any; Cancel, Save |
| An editor asking about unsaved text | Discard or Discard changes; Keep editing, Save |
| The Discard confirmation | Cancel, Discard |

### Discard

- Discard opens its confirmation above it, from its start edge, so it stays inside the comments; StylesUI would centre it on the button. The title is "Discard this comment?" for a draft comment and "Discard this reply?" for a draft reply, and the text beneath is "It hasn't been sent, and you can't get it back." The popover is a `dialog` named by its title, and Cancel takes focus.
- **Discard** in the confirmation deletes the draft, as Discard does now: a draft comment's thread goes, and a draft reply leaves its thread. It is busy until the delete ends. If the server refuses, the popover closes and the card shows the refusal, as it does now.
- **Cancel**, Escape and a click outside close the confirmation and leave the draft as it was. After Cancel or Escape, focus goes back to Discard.
- In a draft editor, confirming also throws away the editor's unsaved text. While the editor is saving, its Discard is disabled.
- The unsaved-text question's Discard and Discard changes don't ask, as now.

### Editor

- The text box is `size="sm"`. It grows with its text from three lines to half the viewport, then scrolls. The user can still drag it taller.
- When it opens on a draft, the caret goes to the end of the text. Asking for the open editor again, and Keep editing, focus the text box without moving the caret.
- A reply editor on a resolved thread shows "Sending reopens this thread." in muted text at the start of its buttons.

### Messages

- The avatar and the name line share a row and are centred against each other. The body sits under the name, in line with it.
- On a 12-hour clock, today's times have no leading zero. On a 24-hour clock they keep it. Other days are unchanged ("8 Oct").

### New replies

- A thread's messages are marked seen when it is selected, however that happens, and when the user presses Reply, Edit, Resolve or Discard on its card.
- The Resolved group opens by itself whenever the number of its threads with a new reply rises, including when the page loads. Folding it keeps it folded until that number rises again.
- While folded, its heading carries an `info` badge, such as "3 new replies", after its count. The badge goes when no thread in the group has a new reply.
- A resolved thread shows Resolved, and New reply when it has one, but not Outdated.

### Composer

The empty-panel hint is hidden while the composer is open.

## 7. Components

| File | Change |
| --- | --- |
| `ThreadCard/DiscardDraftButton.tsx` (new) | Discard and its confirmation popover. Used by the read-only card and the draft editor. The popover is uncontrolled: StylesUI 0.6.0's `usePopover`, when controlled, throws when it is opened again after Escape |
| `ThreadCard/moveFocusPastCard.ts` (new) | Moves focus off a card that is going: to the next card's location in view, the previous one's, or the panel's first button, **+ Comment** |
| `ThreadCard/ThreadActions.tsx` | Discard on read-only drafts; no Resolve while there is a draft reply; every button `secondary`; marks seen on each action; moves focus after Discard; the reopening hint for a resolved thread's reply editor |
| `ThreadCard/Message.tsx`, `ThreadCard.module.css` | The avatar, name line and body as three items of the message's grid |
| `ThreadCard/ThreadCard.tsx` | No Outdated badge on a resolved thread; moves focus past itself when its draft comment is discarded |
| `CommentForm/CommentForm.tsx`, `CommentForm.module.css` | `Textarea size="sm"`, `field-sizing: content` with its minimum and maximum heights, and the caret to the end on first focus |
| `CommentForm/CommentFormButtons.tsx` | Cancel, Discard and Keep editing `secondary` |
| `ThreadSidebar/CommentsList.tsx` | Marks the selected thread seen whenever `selectedThreadId` changes; gives the Resolved group its new-reply count; hides the hint while the composer is open |
| `ThreadSidebar/ThreadGroup.tsx`, `ThreadGroup.module.css` | Opens when its new-reply count rises; the badge in its heading |
| `SubmitMenu/SubmitMenu.tsx` | Cancel `secondary` |
| `review/formatMessageTime.ts` | The hour's form from the locale's hour cycle |

`CommentsList` already holds `useSeenMessages`. Selecting by the doc already sets `selectedThreadId`, so an effect on it covers selecting by the highlight and the marker. The location link keeps marking seen in its own handler, so clicking it again on a selected thread still clears a reply that arrived since.

## 8. Conventions

The `coding-standards` plugin's TypeScript, React, comments and Vitest standards apply, and win over any code in this spec. Follow the code around each change:

- CSS stays in each component's module, with properties in alphabetical order.
- A comment says why, not what, in a sentence with no full stop at the end.
- Tests are named `must … when …`.
- Every new export is used by code or tests in the same commit, or `fallow audit` fails the commit.

The message's layout, for example:

```tsx
<div className={styles.message}>
  <Avatar className={clsx({ [styles.agent ?? ""]: author === "agent" })} name={name} size="xs" aria-hidden={true} />
  <Cluster gap={2}>
    <Text size="sm" weight="bold">
      {name}
    </Text>
    {sentAt === null ? (
      <Badge tone="warning">Draft</Badge>
    ) : (
      <time className={styles.time} dateTime={sentAt} title={fullDateOf(sentAt)}>
        {formatMessageTime(sentAt, now)}
      </time>
    )}
  </Cluster>
  <Text as="p" className={styles.body} size="sm">
    {body}
  </Text>
</div>
```

```css
/* The avatar shares the name's row, so it stays centred on it whether the row holds a time or a taller badge */
.message {
  align-items: center;
  column-gap: var(--sui-space-2);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  row-gap: var(--sui-space-1);
}

.message > .body {
  grid-column: 2;
}
```

## 9. Testing

### Unit and component tests (`web` project, jsdom)

- **`ThreadCard.test.tsx`:**
  - The table of buttons in section 6 replaces "must offer $buttons when $condition", including no Resolve on an open thread with a draft reply.
  - "must ask before discarding, and delete the draft only when the user confirms, when the user discards a draft comment", and the same for a draft reply and for the draft editor's Discard.
  - "must keep the draft and return focus to Discard when the user cancels the confirmation", by Cancel and by Escape.
  - "must focus Cancel when the confirmation opens"
  - "must not show Outdated when a resolved thread's passage has gone"
  - "must say that sending reopens the thread when the user replies to a resolved thread"
- **`ThreadSidebar.test.tsx`:**
  - "must move focus to the next card's location when the user discards a draft comment", then to the previous one's, then to **+ Comment**.
  - "must clear New reply when the user selects the thread in the doc", and when they press Reply, Edit or Resolve.
  - "must open the Resolved group when a resolved thread gets a reply the user hasn't seen", and "must show how many resolved threads have new replies while the group is folded".
  - "must hide the empty-panel hint while the composer is open"
  - Tests that find the unsaved-text question's Discard look inside the editor, since a read-only draft now shows a Discard of its own.
- **`CommentForm` tests:** "must put the caret at the end when the editor opens on a draft", and "must leave the caret where it was when the user keeps editing".
- **`formatMessageTime.test.ts`:** "4:27 PM" in `en-US` and "09:05" in `en-GB`, besides the existing cases.

### Conformance

`pnpm vitest run --project web src/web/rendering/blockConformance.test.ts` passes unchanged.

### End-to-end tests (Playwright, Chromium and WebKit, `comments.e2e.ts`)

jsdom lays nothing out, so sizes and positions are checked here.

- "must close a draft reply's editor when the user discards the draft" confirms in the popover.
- "must discard a draft from its card without opening the editor when the user confirms"
- "must keep the draft and return focus to Discard when the user presses Escape in the confirmation", "must open the confirmation again when the user presses Discard after closing it with Escape", "must open the confirmation inside the comments, from Discard's start edge" and "must move focus to the next card's location when the user discards a draft comment"
- "must give the editor the read-only text's font size and line height when the user edits a draft"
- "must show all of a five-line draft without scrolling when the user edits it"
- "must centre each avatar on its name line when a thread has messages and a draft reply": within 0.5px.

### By hand

In light and dark mode and in every palette, look at a draft comment, an open thread, a thread with a draft reply and a resolved thread, each read and being edited, and the confirmation.

## 10. Commands

```sh
GITHUB_TOKEN=$(gh auth token) pnpm install                                    # first, in a new worktree
pnpm vitest run --project web src/web/components src/web/review               # the component and unit tests above
pnpm vitest run --project web src/web/rendering/blockConformance.test.ts      # canonical text unchanged
pnpm test:e2e src/e2e/comments.e2e.ts                                         # Chromium and WebKit
pnpm verify                                                                   # lint, format check, typecheck and tests
pnpm build                                                                    # dist/cli.js and dist/web
pnpm test:e2e                                                                 # every end-to-end test
pnpm exec fallow audit                                                        # what the pre-commit hook runs
```

To look by hand: `pnpm build`, then in a git repo with a spec, `MARKDOWN_REVIEW_NO_BROWSER=1 node <this repo>/dist/cli.js open <doc.md>`. Open the URL, and play the agent with `reply` and `resolve` to get threads in each state.

## 11. Boundaries

- **Always:** keep every change inside `src/web`; run the component tests, the conformance test and the end-to-end tests in both browsers before committing; check light and dark mode.
- **Ask first:** changing StylesUI, such as adding a dialog; changing the store, the HTTP API or the CLI, such as making the server refuse Resolve on a thread with a draft reply; adding a dependency; changing the groups or their order.
- **Not in this change:** the `danger` button, which is made in StylesUI first and then used here.
- **Never:** change `anchoringVersion` or `protocolVersion` for this; let a Discard that deletes a saved draft skip its confirmation; edit older specs, which record the design as it was.

## 12. Docs to update

The README's paragraph on drafts says "Click **Edit** to change one." It gains: "Click **Discard** to throw one away; it asks first."

## 13. Out of scope

These came up in the review but need their own specs:

- **Messages as markdown.** Agents write `` `code` `` and lists in their answers, which show as raw backticks and asterisks. Rendering messages with the inline rules of `createMarkdownIt` and DOMPurify would not change the canonical text, since messages are not anchored.
- **Showing what the agent changed.** A resolved thread whose passage was rewritten points at a line, but the doc doesn't show what changed there. A per-round diff, or a highlight of the changed blocks, would make checking a round much quicker.
- **Commenting on a whole table.** The gutter's **+** picks the row under the pointer, so a comment on a table quotes one row, with its cells joined by tabs.
- **A `danger` button.** It is added to StylesUI's `Button` first. Then the confirming Discard switches from `secondary` to `danger`, and success criterion 1 changes with it.

## 14. Open questions

None.
