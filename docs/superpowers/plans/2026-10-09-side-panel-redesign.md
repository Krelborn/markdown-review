# Side Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the comments panel read like a professional review tool:
- one comment editor at a time, which asks before unsaved text is lost
- read-only drafts with Edit
- a **+ Comment** menu for doc and review comments
- filter tabs that appear only when they matter
- a Submit popover that lists the drafts by doc
- a tidier doc column and top bar

**Architecture:**
- A new hook, `useCommentEditor`, owns the single open editor: what it writes, its text, saving it, and the question it asks about unsaved text.
  - `App` calls it and hands it to `ThreadSidebar`, which provides it through `CommentEditorContext` to the composer and the thread cards.
  - Every editor renders the same `CommentForm`.
- The panel gains a sticky `CommentsHeader` (title or tabs, the **+ Comment** menu, and the narrow layout's Hide comments button), and `threadsInView` decides what it lists.
- `SubmitMenu` becomes a verdict popover fed by `countDraftsByDocument`.
- `useThreadHighlights` highlights the passage of the comment being written.
- The protocol, store, HTTP API and CLI do not change.

**Tech Stack:** React 19.3 with the React Compiler, `@krelborn/stylesui` 0.2.1, CSS modules, `clsx`, Vitest 5 with jsdom and Testing Library, Playwright 1.64 (Chromium and WebKit), oxlint, oxfmt, fallow.

**Spec:** `docs/superpowers/specs/2026-10-09-side-panel-redesign-design.md`. It changes section 10 of `docs/superpowers/specs/2026-10-08-markdown-review-design.md`.

## Global Constraints

- **Coding standards.** The `coding-standards` plugin's TypeScript, React, comments and Vitest standards are authoritative over this plan's code. They require:
  - props sorted alphabetically in interfaces and JSX, then `aria-*`, then `data-*`
  - explicit boolean values (`disabled={true}`)
  - `clsx` for conditional classes
  - full words in identifiers
  - multi-line JSDoc, and no comment where the code already says it
  - imports grouped external, then `../`, then `./`, with type imports before value imports from the same module
  - tests named `must … when …`, with Arrange-Act-Assert separated by blank lines, a blank line between tests, and one `describe` per file
- **Labels.** These are copied from the spec, and tests find elements by them:

  | Element | Label |
  | --- | --- |
  | Save button, on every editor | **Save** |
  | Cancel button | **Cancel** |
  | Draft editor's delete button | **Discard** |
  | Question buttons | **Discard** or **Discard changes**, **Keep editing**, **Save** |
  | Question titles | "Save this comment first?", "Save your changes first?", "Save this comment?", "Save your changes?" |
  | Question second line | "You started another comment.", "You started a reply to #N.", "You started editing #N." |
  | Header buttons | **+ Comment** (menu items **On this doc** and **On the whole review**); **+ Review comment** on the docs list |
  | Filter tabs | **This doc** and **All docs**, each with a count |
  | Badges | **Draft**, **New reply**, **Outdated**, **Resolved** |
  | Submit popover | title "Submit review"; verdicts **Request changes** and **Approve** |

- **Button variants.** Cancel, Discard, Discard changes, Keep editing and Resolve use `outline`. Edit and Reply use `secondary`. Save uses `primary`. Buttons in an editor sit on the right in Mac order, Cancel then Save, and Discard sits alone on the left.
- **Breakpoint.** 48rem, written as `(width < 48rem)` and `(width >= 48rem)`, as in `App.module.css`.
- **No protocol change.** Nothing under `src/shared`, `src/server` or `src/cli` changes, and `protocolVersion` stays 1.
- **fallow audit.** The pre-commit hook runs `fallow audit` against the merge base with `origin/main`.
  - Every new export must be used, by code or tests, in the same commit.
  - No function may exceed cyclomatic 20 or cognitive 15.
  - `DocumentView` (cognitive 15), `App` (14) and `CommentForm` (13) start near the limit. This plan keeps them within it:
    - `App` swaps its `useState` for `useCommentEditor` and loses the drawer header.
    - `CommentForm` moves its buttons, question and keys into their own units.
    - `DocumentView` loses its Comment on this doc button before it gains a prop.
  - Each task runs `pnpm exec fallow audit` before committing.
- **Dependencies.** No new dependencies.
- **Commits.** Each commit message is one sentence that describes the behaviour, as in `git log`, followed by a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Missing modules.** Vitest's `web` project reports a missing module as `Failed to resolve import "./X" from "…". Does the file exist?`. That is the expected failure wherever a step's test imports a module the task has not written yet.
- **Visual checks.** Tasks 2, 3, 5, 6 and 7 end by looking at the page in light and dark mode. To set up a sample review:

  ```bash
  pnpm build
  sample=$(mktemp -d) && git -C "$sample" init -q && mkdir "$sample/docs"
  printf '# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n' > "$sample/docs/plan.md"
  printf '# Spec\n\nResults are cached.\n' > "$sample/docs/spec.md"
  git -C "$sample" add -A && git -C "$sample" commit -qm sample
  (cd "$sample" && MARKDOWN_REVIEW_NO_BROWSER=1 node "$OLDPWD/dist/cli.js" open docs/plan.md)
  ```

  Then open the printed URL with `playwright-cli open <url>` and take screenshots with `playwright-cli screenshot`. For dark mode, run `playwright-cli run-code "async page => page.emulateMedia({ colorScheme: 'dark' })"` first. Stop the server afterwards with `(cd "$sample" && node "$OLDPWD/dist/cli.js" stop)`.
- **Commands.**
  - One web test file: `pnpm test --project web <path>`.
  - Every web test: `pnpm test --project web`.
  - End-to-end tests, which build the package first: `pnpm test:e2e`.
  - Before every commit: `pnpm lint && pnpm typecheck && pnpm format`.

## Review Focus

These inputs follow from the spec but are easy to miss. Each one has a test in the task that owns the code.

1. **The agent resolves a thread while the user is replying to it.** The thread moves to Resolved, which is folded by default. The reply must stay visible with its text, so the Resolved group opens while it holds the thread being edited. Pinned in Task 3 (`App.test.tsx`, "must keep the user's unsent reply in view when the agent resolves the thread").
2. **The user opens Submit while the editor holds unsaved text.** Submitting would send a draft's saved text, not the edit on screen, and the editor would then close. The popover must say to save or discard the comment first, and its Submit must be disabled. Pinned in Task 6 (`ReviewBar.test.tsx`).
3. **The user clears a draft's text, then starts another comment.** The question appears, but Save is disabled because the text is blank. Focus must go to Keep editing. Discard changes must leave the saved draft as it was, not delete it. Pinned in Task 4 (`ThreadSidebar.test.tsx`).
4. **The user selects the same text again and presses Comment while its composer is open.** This is a request for the editor that is already open. It must not ask, it must keep the text, and focus must return to the text box. Pinned in Task 4 (`App.test.tsx`).
5. **The user presses Cmd+Enter in an empty reply.** `requestSubmit` ignores the disabled Save button, so the save must refuse by itself. Nothing is saved and the editor stays open. Pinned in Task 4 (`ThreadSidebar.test.tsx`).

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/web/review/EditorTarget.ts` (new) | What the editor writes: a new comment, or a thread's draft | 1 |
| `src/web/review/useCommentEditor.ts` (new) | The single editor: target, text, save, the question | 1, 3, 4 |
| `src/web/review/useLeavePageWarning.ts` (new) | `beforeunload` warning while there is unsaved text | 4 |
| `src/web/review/CommentEditorContext.ts`, `useCommentEditorContext.ts` (new) | Gives the editor to the composer and the cards | 3 |
| `src/web/testing/CommentEditorHarness.tsx` (new) | Runs the editor around a component under test | 3 |
| `src/web/review/formatMessageTime.ts` (new) | "10:42" today, "8 Oct" otherwise | 2 |
| `src/web/review/threadsInView.ts` (new) | Which threads the panel lists, the counts, and whether to offer tabs | 5 |
| `src/web/review/countDraftsByDocument.ts` (new) | Drafts per doc for the Submit popover; replaces `countDrafts.ts` | 6 |
| `src/web/review/pendingPassageOn.ts` (new) | The passage of the comment being written, if it is on the doc on screen | 7 |
| `src/web/review/UnsentTextContext.ts`, `useUnsentText.ts`, `countDrafts.ts` | Deleted | 3, 6 |
| `src/web/components/ThreadCard/Message.tsx` (new) | One message: avatar, author, time or Draft badge, body | 2 |
| `src/web/components/ThreadCard/ThreadCard.tsx` | Header with `#id` and location link, badges, messages, editing ring | 2, 3 |
| `src/web/components/ThreadCard/ThreadActions.tsx` | The read-only draft, its editor, and Reply, Edit and Resolve | 3 |
| `src/web/components/ThreadSidebar/ThreadGroup.tsx` | Muted uppercase heading with a `Counter` | 2 |
| `src/web/components/ThreadSidebar/ThreadSidebar.tsx` | Header or tabs, the list, the editor context | 3, 5 |
| `src/web/components/ThreadSidebar/CommentsList.tsx` (new) | The composer, the empty text, the groups | 5 |
| `src/web/components/ThreadSidebar/NewCommentForm.tsx` | The composer | 3, 4 |
| `src/web/components/CommentForm/CommentForm.tsx` | The open editor's form | 3, 4 |
| `src/web/components/CommentForm/CommentFormButtons.tsx`, `UnsavedQuestion.tsx`, `useEditorKeys.ts`, `SaveShortcutHint.tsx` (new) | The editor's buttons, its question, its keys, and the Cmd+Enter hint | 4 |
| `src/web/components/CommentsHeader/CommentsHeader.tsx` (new) | The panel's sticky header | 3, 5 |
| `src/web/components/NewCommentMenu/NewCommentMenu.tsx` (new) | **+ Comment** menu, or **+ Review comment** | 3 |
| `src/web/components/ChevronDownIcon/ChevronDownIcon.tsx` (new) | The chevron on menu buttons | 3 |
| `src/web/components/Quote/Quote.tsx` | `isPending` draws the bar in the primary colour | 3 |
| `src/web/components/ReviewBar/ReviewBar.tsx` | One row; passes drafts and unsaved state to Submit | 6 |
| `src/web/components/SubmitMenu/SubmitMenu.tsx`, `DraftsSummary.tsx`, `VerdictOption.tsx` (new) | The Submit popover | 6 |
| `src/web/components/DocumentView/useThreadHighlights.ts`, `DocumentView.tsx` | The pending highlight; centred prose; no Comment on this doc button | 3, 7 |
| `src/web/components/App/App.tsx`, `DocumentPane.tsx` | Wiring | 3, 5, 6, 7 |
| `src/web/components/TopBar/TopBar.tsx`, `DocumentsMenu/DocumentsMenu.tsx` | Muted folders in the path; Docs as a button with a chevron | 7 |
| `src/web/global.css` | Code blocks get a surface in light mode | 7 |
| `src/e2e/testing/reviewTest.ts`, `src/e2e/layout.e2e.ts`, `src/e2e/review.e2e.ts` | Follow the new labels | 2, 3, 6 |
| `src/e2e/comments.e2e.ts` (new) | One editor, the pending highlight, a reply kept across navigation | 8 |
| `README.md`, `docs/superpowers/specs/2026-10-08-markdown-review-design.md` | Describe the new panel | 8 |

---

### Task 1: Hold one comment editor and save what it writes

**Files:**
- Create: `src/web/review/EditorTarget.ts`
- Create: `src/web/review/useCommentEditor.ts`
- Test: `src/web/review/useCommentEditor.test.tsx`

**Interfaces:**
- Consumes: `NewComment` (`src/web/review/NewComment.ts`), `useReviewApi`, `Thread`.
- Produces:
  - `type EditorTarget = { comment: NewComment; kind: "new" } | { kind: "thread"; threadId: number }`.
  - `useCommentEditor({ onChanged, threads }): CommentEditor`. In this task the `CommentEditor` interface is not exported. Task 3 exports it, once `CommentEditorContext` uses it. Its members, which later tasks rely on:

    | Member | Type |
    | --- | --- |
    | `body` | `string` |
    | `canSave` | `boolean` |
    | `changeBody` | `(body: string) => void` |
    | `close` | `() => void` |
    | `editingThreadId` | `number \| null` |
    | `focusRevision` | `number` |
    | `hasUnsavedText` | `boolean` |
    | `newComment` | `NewComment \| null` |
    | `request` | `(target: EditorTarget) => void` |
    | `save` | `() => Promise<void>` |
    | `savedBody` | `string \| null` |

  - In this task, `request` always replaces the open editor. Task 4 makes it ask first when there is unsaved text.

- [ ] **Step 1: Write the failing tests**

Create `src/web/review/useCommentEditor.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../shared/review/threadSchema";
import { ReviewApiContext } from "../api/ReviewApiContext";
import { ReviewApiError } from "../api/ReviewApiError";
import { createFakeReviewApi } from "../testing/createFakeReviewApi";

import type { EditorTarget } from "./EditorTarget";
import { useCommentEditor } from "./useCommentEditor";

const reviewComment: EditorTarget = { comment: { anchor: { kind: "review" } }, kind: "new" };

const draftComment = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  id: 1,
  messages: [],
  status: "draft",
});

const openThread = buildThread({ anchor: buildPassageAnchor({ startOffset: 40 }), id: 2 });

const editDraft: EditorTarget = { kind: "thread", threadId: 1 };

const reply: EditorTarget = { kind: "thread", threadId: 2 };

describe("useCommentEditor", () => {
  test("must open an empty editor with nothing unsaved when the user starts a new comment", () => {
    const { render } = setUpTest();
    const { result } = render();

    act(() => result.current.request(reviewComment));

    expect(result.current).toMatchObject({
      body: "",
      editingThreadId: null,
      hasUnsavedText: false,
      newComment: { anchor: { kind: "review" } },
      savedBody: null,
    });
  });

  test("must open a draft's editor with its saved text when the user edits the draft", () => {
    const { render } = setUpTest();
    const { result } = render();

    act(() => result.current.request(editDraft));

    expect(result.current).toMatchObject({
      body: "Why 24h?",
      editingThreadId: 1,
      hasUnsavedText: false,
      newComment: null,
      savedBody: "Why 24h?",
    });
  });

  test.each<{ condition: string; expected: boolean; target: EditorTarget; text: string }>([
    { condition: "a new comment is blank", expected: false, target: reviewComment, text: " \n" },
    { condition: "a new comment has text", expected: true, target: reviewComment, text: "Why?" },
    { condition: "a reply has text", expected: true, target: reply, text: "Hourly" },
    { condition: "a draft is unchanged", expected: false, target: editDraft, text: "Why 24h?" },
    { condition: "a draft is changed", expected: true, target: editDraft, text: "Why 1h?" },
    { condition: "a draft is cleared", expected: true, target: editDraft, text: "" },
  ])("must report unsaved text as $expected when $condition", ({ expected, target, text }) => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(target));

    act(() => result.current.changeBody(text));

    expect(result.current.hasUnsavedText).toBe(expected);
  });

  test.each<{ condition: string; expected: boolean; target: EditorTarget; text: string }>([
    { condition: "a reply has text", expected: true, target: reply, text: "Hourly" },
    { condition: "a new comment is blank", expected: false, target: reviewComment, text: "  " },
    { condition: "a draft is unchanged", expected: false, target: editDraft, text: "Why 24h?" },
    { condition: "a draft is cleared", expected: false, target: editDraft, text: "" },
  ])("must allow saving as $expected when $condition", ({ expected, target, text }) => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(target));

    act(() => result.current.changeBody(text));

    expect(result.current.canSave).toBe(expected);
  });

  test("must save a new comment as a draft thread and close the editor when the user saves it", async () => {
    const { fake, onChanged, render } = setUpTest({ threads: [] });
    const { result } = render();
    act(() => result.current.request(reviewComment));
    act(() => result.current.changeBody("The spec and plan disagree."));

    await act(() => result.current.save());

    expect(fake.snapshot.threads).toMatchObject([
      { anchor: { kind: "review" }, draft: { body: "The spec and plan disagree." }, status: "draft" },
    ]);
    expect(onChanged).toHaveBeenCalled();
    expect(result.current.newComment).toBeNull();
  });

  test("must save a reply as its thread's draft and close the editor when the user saves it", async () => {
    const { fake, render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly, then"));

    await act(() => result.current.save());

    expect(fake.snapshot.threads[1]?.draft?.body).toBe("Hourly, then");
    expect(result.current.editingThreadId).toBeNull();
  });

  test("must keep the editor open with its text when the server refuses the save", async () => {
    const { fake, render } = setUpTest();
    fake.api.writeDraft.mockRejectedValueOnce(new ReviewApiError(409, "invalid-file", "review.json is not valid"));
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly, then"));

    await act(() => expect(result.current.save()).rejects.toThrow("review.json is not valid"));

    expect(result.current).toMatchObject({ body: "Hourly, then", editingThreadId: 2 });
  });

  test("must leave the draft and the editor as they are when the user saves with nothing to save", async () => {
    const { fake, render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(editDraft));

    await act(() => result.current.save());

    expect(fake.snapshot.threads[0]?.updatedAt).toBe(testTime);
    expect(result.current.editingThreadId).toBe(1);
  });

  test("must open the new editor in place of the open one when the user starts another", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));

    act(() => result.current.request(editDraft));

    expect(result.current).toMatchObject({ body: "Why 24h?", editingThreadId: 1 });
  });

  test("must keep the text and move focus back when the user asks again for the open editor", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    const focusRevision = result.current.focusRevision;

    act(() => result.current.request(reply));

    expect(result.current.body).toBe("Hourly");
    expect(result.current.focusRevision).toBeGreaterThan(focusRevision);
  });

  test.each([
    { condition: "its thread disappears", threads: [openThread] },
    {
      condition: "its draft is submitted elsewhere",
      threads: [buildThread({ anchor: buildPassageAnchor(), id: 1 }), openThread],
    },
  ])("must close a draft's editor when $condition", ({ threads }) => {
    const { render } = setUpTest();
    const { rerender, result } = render();
    act(() => result.current.request(editDraft));

    rerender({ shown: threads });

    expect(result.current.editingThreadId).toBeNull();
  });
});

function setUpTest({ threads = [draftComment, openThread] }: { threads?: Thread[] } = {}) {
  const fake = createFakeReviewApi({ threads });
  const onChanged = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReviewApiContext value={fake.api}>{children}</ReviewApiContext>
  );
  const render = () =>
    renderHook(({ shown }: { shown: Thread[] }) => useCommentEditor({ onChanged, threads: shown }), {
      initialProps: { shown: threads },
      wrapper,
    });
  return { fake, onChanged, render };
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --project web src/web/review/useCommentEditor.test.tsx`
Expected: FAIL with `Failed to resolve import "./useCommentEditor"`.

- [ ] **Step 3: Write `EditorTarget`**

Create `src/web/review/EditorTarget.ts`:

```ts
import type { NewComment } from "./NewComment";

/**
 * What the comment editor writes: a comment the user has started, or a thread's draft, which is a new reply until it is
 * first saved
 */
export type EditorTarget = { comment: NewComment; kind: "new" } | { kind: "thread"; threadId: number };
```

- [ ] **Step 4: Write `useCommentEditor`**

Create `src/web/review/useCommentEditor.ts`:

```ts
import { useState } from "react";

import type { Thread } from "../../shared/review/threadSchema";
import { useReviewApi } from "../api/useReviewApi";

import type { EditorTarget } from "./EditorTarget";
import type { NewComment } from "./NewComment";

interface CommentEditorOptions {
  /**
   * Called after the editor saves to the server
   */
  onChanged: () => void;

  /**
   * Every thread in the repo
   */
  threads: readonly Thread[];
}

interface CommentEditor {
  /**
   * The open editor's text
   */
  body: string;

  /**
   * Whether Save would save anything: the text is unsaved and not blank
   */
  canSave: boolean;

  /**
   * Replaces the open editor's text
   */
  changeBody: (body: string) => void;

  /**
   * Closes the open editor, throwing away any unsaved text
   */
  close: () => void;

  /**
   * The thread whose reply or draft the open editor writes, or null
   */
  editingThreadId: number | null;

  /**
   * Changes each time the open editor's text box should take focus: when it opens, and when the user asks for it again
   */
  focusRevision: number;

  /**
   * Whether the open editor holds text that is not saved: for a new comment or reply, any text that is not blank; for a
   * draft, text that differs from the saved draft
   */
  hasUnsavedText: boolean;

  /**
   * The comment the open editor starts, or null when it writes to a thread
   */
  newComment: NewComment | null;

  /**
   * Asks for an editor on the target, which replaces the open one, or takes focus when it is the open one
   */
  request: (target: EditorTarget) => void;

  /**
   * Saves the open editor's text, as a new draft thread or as its thread's draft, and closes the editor; does nothing
   * when there is nothing to save
   *
   * @returns a promise that rejects with the server's refusal, which leaves the editor open with its text
   */
  save: () => Promise<void>;

  /**
   * The open editor's saved draft, or null when it writes a new comment or a new reply
   */
  savedBody: string | null;
}

interface OpenEditor {
  body: string;

  /**
   * Whether its thread had a draft when it opened, so that it closes once that draft is gone
   */
  hadDraft: boolean;

  target: EditorTarget;
}

interface EditorState {
  focusRevision: number;
  open: OpenEditor | null;
}

/**
 * The one comment editor on the page: what it writes, its text, and saving it
 *
 * @returns the editor; it closes by itself when the thread it writes to disappears, or loses the draft it was editing
 */
export function useCommentEditor({ onChanged, threads }: CommentEditorOptions): CommentEditor {
  const api = useReviewApi();
  const [state, setState] = useState<EditorState>({ focusRevision: 0, open: null });
  const open = state.open !== null && isStillOpen(state.open, threads) ? state.open : null;
  const savedBody = open === null ? null : savedBodyOf(open.target, threads);
  const hasUnsavedText = open !== null && differsFromSaved(open.body, savedBody);
  const canSave = open !== null && hasUnsavedText && open.body.trim() !== "";
  const show = (next: OpenEditor | null): void => {
    setState(({ focusRevision }) => ({ focusRevision: focusRevision + 1, open: next }));
  };
  const save = async (): Promise<void> => {
    if (open === null || !canSave) {
      return;
    }
    const { body, target } = open;
    await (target.kind === "new"
      ? api.createThread({ ...target.comment, body })
      : api.writeDraft(target.threadId, body));
    onChanged();
    show(null);
  };
  return {
    body: open?.body ?? "",
    canSave,
    changeBody: (body) => {
      setState((current) => ({ ...current, open: current.open && { ...current.open, body } }));
    },
    close: () => show(null),
    editingThreadId: threadIdOf(open),
    focusRevision: state.focusRevision,
    hasUnsavedText,
    newComment: newCommentOf(open),
    request: (target) => {
      show(open !== null && isSameTarget(open.target, target) ? open : editorFor(target, threads));
    },
    save,
    savedBody,
  };
}

function editorFor(target: EditorTarget, threads: readonly Thread[]): OpenEditor {
  const savedBody = savedBodyOf(target, threads);
  return { body: savedBody ?? "", hadDraft: savedBody !== null, target };
}

function savedBodyOf(target: EditorTarget, threads: readonly Thread[]): string | null {
  return target.kind === "thread" ? (threadOf(target.threadId, threads)?.draft?.body ?? null) : null;
}

function isStillOpen({ hadDraft, target }: OpenEditor, threads: readonly Thread[]): boolean {
  if (target.kind === "new") {
    return true;
  }
  const thread = threadOf(target.threadId, threads);
  return thread !== undefined && (!hadDraft || thread.draft !== undefined);
}

function differsFromSaved(body: string, savedBody: string | null): boolean {
  return savedBody === null ? body.trim() !== "" : body !== savedBody;
}

function isSameTarget(left: EditorTarget, right: EditorTarget): boolean {
  if (left.kind === "thread" && right.kind === "thread") {
    return left.threadId === right.threadId;
  }
  if (left.kind === "new" && right.kind === "new") {
    return JSON.stringify(left.comment.anchor) === JSON.stringify(right.comment.anchor);
  }
  return false;
}

function newCommentOf(open: OpenEditor | null): NewComment | null {
  return open !== null && open.target.kind === "new" ? open.target.comment : null;
}

function threadIdOf(open: OpenEditor | null): number | null {
  return open !== null && open.target.kind === "thread" ? open.target.threadId : null;
}

function threadOf(threadId: number, threads: readonly Thread[]): Thread | undefined {
  return threads.find((thread) => thread.id === threadId);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test --project web src/web/review/useCommentEditor.test.tsx`
Expected: PASS, 20 tests.

- [ ] **Step 6: Check, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm format && pnpm exec fallow audit`
Expected: no lint or type errors; fallow's verdict is not `fail`.

```bash
git add src/web/review/EditorTarget.ts src/web/review/useCommentEditor.ts src/web/review/useCommentEditor.test.tsx
git commit -m "Hold the page's one comment editor, its text and whether it is saved, and save it as a draft

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Show who wrote each message and when, and give thread cards a clear hierarchy

**Files:**
- Create: `src/web/review/formatMessageTime.ts`
- Test: `src/web/review/formatMessageTime.test.ts`
- Create: `src/web/components/ThreadCard/Message.tsx`
- Modify: `src/web/components/ThreadCard/ThreadCard.tsx`, `ThreadCard.module.css`
- Modify: `src/web/components/ThreadSidebar/ThreadGroup.tsx`, `ThreadGroup.module.css`
- Modify: `src/web/components/App/App.module.css`
- Test: `src/web/components/ThreadCard/ThreadCard.test.tsx`, `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`, `src/web/components/App/App.test.tsx`, `src/e2e/review.e2e.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `formatMessageTime(at: string, now: Date, locales?: Intl.LocalesArgument): string`
  - `Message({ author: "agent" | "user"; body: string; sentAt: string | null }): JSX.Element`. A null `sentAt` shows a Draft badge in place of the time. Task 3 uses it for a draft reply.
  - `ThreadCard.module.css` keeps `.body` and gains `.message`, `.time`, `.agent`, `.id` and `.location`.
  - Group headings are named "Drafts 1", "Open 2" and so on. Thread location buttons keep names like "#1 Line 3".

- [ ] **Step 1: Write the failing test for the message time**

Create `src/web/review/formatMessageTime.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { formatMessageTime } from "./formatMessageTime";

const now = new Date("2026-10-08T16:00:00.000Z");

describe("formatMessageTime", () => {
  test.each([
    { at: "2026-10-08T10:42:00.000Z", condition: "it was sent today", expected: "10:42" },
    { at: "2026-10-07T23:59:00.000Z", condition: "it was sent yesterday", expected: "7 Oct" },
    { at: "2025-10-08T10:42:00.000Z", condition: "it was sent on this day last year", expected: "8 Oct" },
  ])("must show $expected when $condition", ({ at, expected }) => {
    expect(formatMessageTime(at, now, "en-GB")).toBe(expected);
  });
});
```

The `web` project runs with `TZ=UTC`, so these dates fall on the days they name.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test --project web src/web/review/formatMessageTime.test.ts`
Expected: FAIL with `Failed to resolve import "./formatMessageTime"`.

- [ ] **Step 3: Write `formatMessageTime`**

Create `src/web/review/formatMessageTime.ts`:

```ts
/**
 * Formats when a message was sent, for the comments
 *
 * @param at when it was sent, as an ISO 8601 string
 * @param now the time it is now
 * @param locales the locales to format for; by default, the browser's
 * @returns the time of day, such as "10:42", for a message sent today, otherwise the day and month, such as "8 Oct"
 */
export function formatMessageTime(at: string, now: Date, locales?: Intl.LocalesArgument): string {
  const sent = new Date(at);
  if (sent.toDateString() === now.toDateString()) {
    return sent.toLocaleTimeString(locales, { hour: "2-digit", minute: "2-digit" });
  }
  return sent.toLocaleDateString(locales, { day: "numeric", month: "short" });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test --project web src/web/review/formatMessageTime.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Update the card and group tests for the new look**

In `src/web/components/ThreadCard/ThreadCard.test.tsx`:

1. Change the vitest import to `import { describe, expect, onTestFinished, test, vi } from "vitest";` and add `import { formatMessageTime } from "../../review/formatMessageTime";` after the `ReviewApiError` import.
2. Replace the test `"must show the passage and who wrote each message when the thread has a conversation"` with these three tests:

```tsx
  test("must show the passage, and who wrote each message, when the thread has a conversation", () => {
    const { render } = setUpTest({ thread: conversation });

    render();

    const [question, answer] = within(screen.getByRole("list", { name: "Messages" })).getAllByRole("listitem");
    expect(screen.getByText("cache results for 24h")).toBeInTheDocument();
    expect(question).toHaveTextContent("You");
    expect(question).toHaveTextContent("Why 24h?");
    expect(answer).toHaveTextContent("Agent");
    expect(answer).toHaveTextContent("Upstream data changes daily.");
  });

  test("must show when each message was sent", () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T12:00:00.000Z"), toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { render } = setUpTest({ thread: conversation });

    render();

    const sentAt = "2026-10-08T09:05:00.000Z";
    expect(screen.getByText(formatMessageTime(sentAt, new Date()))).toHaveAttribute("datetime", sentAt);
  });

  test("must mark a new comment as a draft when the user has not submitted it", () => {
    const { render } = setUpTest({
      thread: buildThread({ draft: { at: testTime, body: "Why 24h?" }, messages: [], status: "draft" }),
    });

    render();

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
```

3. In `"must mark the thread when the agent has written since the user last viewed it"`, change `screen.getByText("New")` to `screen.getByText("New reply")`.

In `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`:

1. In the first test, change the expected group titles to `["Drafts 1", "Open 2", "Outdated 1", "Resolved 1"]`.
2. In `"must stop marking the agent's reply as new when the user selects its thread"`, change both `card.queryByText("New")` calls to `card.queryByText("New reply")`.

In `src/web/components/App/App.test.tsx`, in `"must keep the user's unsent reply when the agent resolves the thread"`, replace `await user.click(resolved.getByText("Resolved (1)"));` with:

```tsx
    await user.click(resolved.getByRole("heading", { name: "Resolved 1" }));
```

In `src/e2e/review.e2e.ts`, in `"must move the thread to Resolved and show the agent's note when the agent resolves it"`, replace `await resolved.getByText("Resolved (1)").click();` with:

```ts
  await resolved.getByRole("heading", { name: "Resolved 1" }).click();
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm test --project web src/web/components/ThreadCard src/web/components/ThreadSidebar src/web/components/App`
Expected: FAIL. The new time and Draft tests fail, "New reply" is not found, and the group titles are still "Drafts (1)".

- [ ] **Step 7: Write `Message`**

Create `src/web/components/ThreadCard/Message.tsx`:

```tsx
import { Avatar, Badge, Cluster, Stack, Text } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";

import { formatMessageTime } from "../../review/formatMessageTime";

import styles from "./ThreadCard.module.css";

export interface MessageProps {
  author: "agent" | "user";
  body: string;

  /**
   * When the message was sent, or null for the user's draft reply, which shows a Draft badge in its place
   */
  sentAt: string | null;
}

/**
 * One message in a thread: who wrote it, when, and what it says
 */
export function Message({ author, body, sentAt }: MessageProps): JSX.Element {
  const name = author === "user" ? "You" : "Agent";
  return (
    <div className={styles.message}>
      <Avatar className={clsx({ [styles.agent ?? ""]: author === "agent" })} name={name} size="xs" aria-hidden={true} />
      <Stack gap={1}>
        <Cluster gap={2}>
          <Text size="sm" weight="bold">
            {name}
          </Text>
          {sentAt === null ? (
            <Badge tone="warning">Draft</Badge>
          ) : (
            <time
              className={styles.time}
              dateTime={sentAt}
              title={new Date(sentAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            >
              {formatMessageTime(sentAt, new Date())}
            </time>
          )}
        </Cluster>
        <Text as="p" className={styles.body} size="sm">
          {body}
        </Text>
      </Stack>
    </div>
  );
}
```

- [ ] **Step 8: Rewrite `ThreadCard`**

Replace `src/web/components/ThreadCard/ThreadCard.tsx` with:

```tsx
import { Badge, Card, Cluster, Stack, Text } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useEffect, useRef } from "react";

import type { Anchor } from "../../../shared/review/anchorSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { describeLocation } from "../../review/describeLocation";
import { Quote } from "../Quote/Quote";

import { Message } from "./Message";
import { ThreadActions } from "./ThreadActions";
import styles from "./ThreadCard.module.css";

export interface ThreadCardProps {
  hasNewAgentMessage: boolean;
  isSelected: boolean;

  /**
   * Called after the card changes the thread on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see the thread in its doc
   */
  onSelect: (thread: Thread) => void;

  thread: Thread;
}

/**
 * One thread in the sidebar: where it is and its state, what it is on, its messages, and what the user can do
 */
export function ThreadCard({
  hasNewAgentMessage,
  isSelected,
  onChanged,
  onSelect,
  thread,
}: ThreadCardProps): JSX.Element {
  const { anchor, id, messages } = thread;
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);
  return (
    <Card
      as="article"
      className={clsx(styles.card, { [styles.selected ?? ""]: isSelected })}
      padding="sm"
      ref={cardRef}
      aria-label={`Thread #${id}`}
    >
      <Stack gap={2}>
        <Cluster gap={2} justify="between">
          <ThreadLocation onSelect={() => onSelect(thread)} thread={thread} />
          <ThreadBadges hasNewAgentMessage={hasNewAgentMessage} thread={thread} />
        </Cluster>
        <PassageQuote anchor={anchor} />
        {messages.length > 0 && (
          <Stack as="ol" className={styles.messages} gap={3} aria-label="Messages">
            {messages.map((message) => (
              <li key={message.at + message.author}>
                <Message author={message.author} body={message.body} sentAt={message.at} />
              </li>
            ))}
          </Stack>
        )}
        <ThreadActions onChanged={onChanged} thread={thread} />
      </Stack>
    </Card>
  );
}

function ThreadLocation({ onSelect, thread: { anchor, id } }: { onSelect: () => void; thread: Thread }): JSX.Element {
  const label = (
    <>
      <span className={styles.id}>#{id}</span> {describeLocation(anchor)}
    </>
  );
  if (anchor.kind === "review") {
    return (
      <Text size="sm" weight="medium">
        {label}
      </Text>
    );
  }
  return (
    <button className={styles.location} onClick={onSelect} type="button">
      {label}
    </button>
  );
}

function ThreadBadges({
  hasNewAgentMessage,
  thread: { anchor, status },
}: {
  hasNewAgentMessage: boolean;
  thread: Thread;
}): JSX.Element {
  return (
    <Cluster gap={1}>
      {status === "draft" && <Badge tone="warning">Draft</Badge>}
      {hasNewAgentMessage && <Badge tone="info">New reply</Badge>}
      {anchor.kind === "passage" && anchor.outdated && <Badge tone="warning">Outdated</Badge>}
      {status === "resolved" && <Badge tone="success">Resolved</Badge>}
    </Cluster>
  );
}

function PassageQuote({ anchor }: { anchor: Anchor }): JSX.Element | null {
  if (anchor.kind !== "passage") {
    return null;
  }
  return (
    <>
      <Quote text={anchor.anchoredText} />
      {anchor.quote !== anchor.anchoredText && (
        <Text as="p" size="sm" tone="muted">
          Originally: {anchor.quote}
        </Text>
      )}
    </>
  );
}
```

Replace `src/web/components/ThreadCard/ThreadCard.module.css` with:

```css
/* Cards sit on the panel's surface colour, so they take the page background and lose StylesUI's shadow */
.card {
  --sui-card-bg: var(--sui-color-background);
  --sui-card-shadow: none;
}

/* An inset shadow, so the bar does not change the card's size */
.selected {
  --sui-card-shadow: inset 3px 0 0 var(--sui-color-primary);
}

.location {
  background: none;
  border: none;
  color: var(--sui-color-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--sui-font-size-sm);
  font-weight: var(--sui-font-weight-medium);
  padding: 0;
  text-align: start;
  text-decoration: underline;
  text-decoration-color: var(--sui-color-border);
  text-underline-offset: 2px;
}

.location:hover {
  text-decoration-color: currentColor;
}

.location:focus-visible {
  outline: var(--sui-focus-ring-width) solid var(--sui-color-focus-ring);
  outline-offset: 2px;
}

.id {
  color: var(--sui-color-text-muted);
}

.messages {
  list-style: none;
  padding: 0;
}

.message {
  display: grid;
  gap: var(--sui-space-2);
  grid-template-columns: auto minmax(0, 1fr);
}

.agent {
  background-color: var(--sui-color-primary);
  color: var(--sui-color-on-primary);
}

.time {
  color: var(--sui-color-text-muted);
  font-size: var(--sui-font-size-xs);
}

.body {
  white-space: pre-wrap;
}
```

- [ ] **Step 9: Restyle the group headings**

In `src/web/components/ThreadSidebar/ThreadGroup.tsx`, change the StylesUI import to `import { Counter, Heading, Stack } from "@krelborn/stylesui";` and replace the `heading` constant with:

```tsx
  const heading = (
    <Heading className={styles.heading} level={2} size="xs" tone="muted">
      {title} <Counter count={listProps.threads.length} />
    </Heading>
  );
```

Replace `src/web/components/ThreadSidebar/ThreadGroup.module.css` with:

```css
.heading {
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.summary {
  cursor: pointer;
  margin-block-end: var(--sui-space-2);
}

.summary > .heading {
  display: inline;
}
```

In `src/web/components/App/App.module.css`:
- add `background-color: var(--sui-color-surface);` as the first declaration of the wide `.commentsPanel` rule
- inside the `@media (width < 48rem)` block, change `.commentsPanel`'s `background-color: var(--sui-color-background);` to `background-color: var(--sui-color-surface);`

Leave `.drawerHeader`'s background as it is.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test --project web`
Expected: PASS.

Run: `pnpm test:e2e src/e2e/review.e2e.ts`
Expected: PASS in Chromium and WebKit.

- [ ] **Step 11: Look at it**

Follow "Visual checks" in Global Constraints. Write a comment on a passage, submit it with Request changes, then run `node "$OLDPWD/dist/cli.js" reply 1 "Why not 1h?"` in the sample repo. Check these in light and dark mode:
- the cards sit on the panel's surface colour, with their own background and a border
- the agent's avatar uses the primary colour
- times are muted
- group headings are small, muted and uppercase, with a count pill
- the location reads "#1 Line 3", with the `#1` muted and the location underlined

- [ ] **Step 12: Check, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm format && pnpm exec fallow audit`
Expected: no lint or type errors; fallow's verdict is not `fail`.

```bash
git add src/web/review/formatMessageTime.ts src/web/review/formatMessageTime.test.ts src/web/components/ThreadCard src/web/components/ThreadSidebar src/web/components/App src/e2e/review.e2e.ts
git commit -m "Show who wrote each message and when, mark drafts and new replies, and set the cards apart from the panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Open one editor at a time, show drafts read-only, and start doc and review comments from + Comment

**Files:**
- Modify: `src/web/review/useCommentEditor.ts` (export `CommentEditor`)
- Create: `src/web/review/CommentEditorContext.ts`, `src/web/review/useCommentEditorContext.ts`
- Create: `src/web/testing/CommentEditorHarness.tsx`
- Modify: `src/web/components/CommentForm/CommentForm.tsx`; Create: `CommentForm.module.css`
- Modify: `src/web/components/Quote/Quote.tsx`, `Quote.module.css`
- Create: `src/web/components/ChevronDownIcon/ChevronDownIcon.tsx`
- Create: `src/web/components/NewCommentMenu/NewCommentMenu.tsx`, `NewCommentMenu.module.css`
- Create: `src/web/components/CommentsHeader/CommentsHeader.tsx`, `CommentsHeader.module.css`
- Modify: `src/web/components/ThreadSidebar/NewCommentForm.tsx`; Create: `NewCommentForm.module.css`
- Modify: `src/web/components/ThreadCard/ThreadActions.tsx`, `ThreadCard.tsx`, `ThreadCard.module.css`
- Modify: `src/web/components/ThreadSidebar/ThreadSidebar.tsx`
- Modify: `src/web/components/App/App.tsx`
- Modify: `src/web/components/DocumentView/DocumentView.tsx`, `DocumentView.module.css`
- Delete: `src/web/review/UnsentTextContext.ts`, `src/web/review/useUnsentText.ts`
- Test: `ThreadCard.test.tsx`, `ThreadSidebar.test.tsx`, `App.test.tsx`, `DocumentView.test.tsx`, `src/e2e/testing/reviewTest.ts`, `src/e2e/layout.e2e.ts`

**Interfaces:**
- Consumes: `useCommentEditor` and `EditorTarget` from Task 1; `Message` and the `.body` class from Task 2.
- Produces:
  - `export interface CommentEditor` from `useCommentEditor.ts`.
  - `CommentEditorContext: Context<CommentEditor | null>`, and `useCommentEditorContext(): CommentEditor`, which throws without a provider.
  - `CommentEditorHarness({ children: (editor: CommentEditor) => ReactNode; onChanged; threads })`, for tests.
  - `CommentForm({ label: string; leading?: ReactNode })`. It renders the open editor from context. Task 4 adds the question to it.
  - `CommentsHeader({ documentPath, onComment, title })`. Task 5 adds `closeButton`.
  - `NewCommentMenu({ documentPath, onComment })`.
  - `NewCommentForm({ documentPath, newComment })`.
  - `Quote({ isPending?, text })`.
  - `ChevronDownIcon()`.
  - `ThreadSidebarProps` loses `newComment` and `onCloseNewComment`, and gains `editor: CommentEditor`.

- [ ] **Step 1: Export the editor's type, and add its context and test harness**

In `src/web/review/useCommentEditor.ts`, change `interface CommentEditor {` to `export interface CommentEditor {`.

Create `src/web/review/CommentEditorContext.ts`:

```ts
import { createContext } from "react";

import type { CommentEditor } from "./useCommentEditor";

export const CommentEditorContext = createContext<CommentEditor | null>(null);
```

Create `src/web/review/useCommentEditorContext.ts`:

```ts
import { useContext } from "react";

import { CommentEditorContext } from "./CommentEditorContext";
import type { CommentEditor } from "./useCommentEditor";

/**
 * Gives a component the page's comment editor
 *
 * @returns the editor
 * @throws when no CommentEditorContext surrounds the component
 */
export function useCommentEditorContext(): CommentEditor {
  const editor = useContext(CommentEditorContext);
  if (editor === null) {
    throw new Error("useCommentEditorContext needs a CommentEditorContext around the component");
  }
  return editor;
}
```

Create `src/web/testing/CommentEditorHarness.tsx`:

```tsx
import type { JSX, ReactNode } from "react";

import type { Thread } from "../../shared/review/threadSchema";
import { CommentEditorContext } from "../review/CommentEditorContext";
import type { CommentEditor } from "../review/useCommentEditor";
import { useCommentEditor } from "../review/useCommentEditor";

export interface CommentEditorHarnessProps {
  /**
   * Renders the component under test, given the editor
   */
  children: (editor: CommentEditor) => ReactNode;

  onChanged: () => void;
  threads: readonly Thread[];
}

/**
 * Runs the page's comment editor for a test, as `App` does, and gives it to the component under test both directly and
 * through `CommentEditorContext`
 */
export function CommentEditorHarness({ children, onChanged, threads }: CommentEditorHarnessProps): JSX.Element {
  const editor = useCommentEditor({ onChanged, threads });
  return <CommentEditorContext value={editor}>{children(editor)}</CommentEditorContext>;
}
```

- [ ] **Step 2: Rewrite the card tests for read-only drafts and the single editor**

Replace `src/web/components/ThreadCard/ThreadCard.test.tsx` with:

```tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import { formatMessageTime } from "../../review/formatMessageTime";
import { CommentEditorHarness } from "../../testing/CommentEditorHarness";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadCard } from "./ThreadCard";

const conversation = buildThread({
  anchor: buildPassageAnchor(),
  messages: [
    { at: testTime, author: "user", body: "Why 24h?" },
    { at: "2026-10-08T09:05:00.000Z", author: "agent", body: "Upstream data changes daily." },
  ],
});

const draftComment = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

const draftReply: Thread = { ...conversation, draft: { at: testTime, body: "Hourly, then" } };

describe("ThreadCard", () => {
  test("must show the passage, and who wrote each message, when the thread has a conversation", () => {
    const { render } = setUpTest({ thread: conversation });

    render();

    const [question, answer] = within(screen.getByRole("list", { name: "Messages" })).getAllByRole("listitem");
    expect(screen.getByText("cache results for 24h")).toBeInTheDocument();
    expect(question).toHaveTextContent("You");
    expect(question).toHaveTextContent("Why 24h?");
    expect(answer).toHaveTextContent("Agent");
    expect(answer).toHaveTextContent("Upstream data changes daily.");
  });

  test("must show when each message was sent", () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T12:00:00.000Z"), toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { render } = setUpTest({ thread: conversation });

    render();

    const sentAt = "2026-10-08T09:05:00.000Z";
    expect(screen.getByText(formatMessageTime(sentAt, new Date()))).toHaveAttribute("datetime", sentAt);
  });

  test("must mark a new comment as a draft when the user has not submitted it", () => {
    const { render } = setUpTest({ thread: draftComment });

    render();

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  test("must show the text the user chose as well when an edit moved the passage onto other text", () => {
    const { render } = setUpTest({
      thread: buildThread({ anchor: buildPassageAnchor({ anchoredText: "cache results for 1h" }) }),
    });

    render();

    expect(screen.getByText("Originally: cache results for 24h")).toBeInTheDocument();
  });

  test("must show a draft as text, with Edit and no text box, until the user edits it", () => {
    const { render } = setUpTest({ thread: draftComment });

    render();

    expect(screen.getByText("Why 24h?")).toBeInTheDocument();
    expect(elements.button("Edit")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("must show a draft reply after the messages, marked as a draft, when the user has one", () => {
    const { render } = setUpTest({ thread: draftReply });

    render();

    expect(screen.getByText("Hourly, then")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  test.each<{ buttons: string[]; condition: string; thread: Thread }>([
    { buttons: ["Edit"], condition: "a new comment is a draft", thread: draftComment },
    { buttons: ["Resolve", "Reply"], condition: "an open thread has no draft reply", thread: conversation },
    { buttons: ["Resolve", "Edit"], condition: "an open thread has a draft reply", thread: draftReply },
    {
      buttons: ["Reply"],
      condition: "a resolved thread has no draft reply",
      thread: { ...conversation, status: "resolved" },
    },
    {
      buttons: ["Edit"],
      condition: "a resolved thread has a draft reply",
      thread: { ...draftReply, status: "resolved" },
    },
  ])("must offer $buttons when $condition", ({ buttons, thread }) => {
    const { render } = setUpTest({ thread });

    render();

    expect(elements.actions()).toEqual(buttons);
  });

  test("must save the reply as a draft when the user replies", async () => {
    const { fake, onChanged, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Hourly, then");
    expect(onChanged).toHaveBeenCalled();
  });

  test("must save the user's changes when the user edits a draft", async () => {
    const { fake, render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Edit"));
    await user.type(elements.textbox("Draft comment"), " And why cache?");
    await user.click(elements.button("Save"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h? And why cache?");
  });

  test("must not let the user save a draft when its text is unchanged", async () => {
    const { render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Edit"));

    expect(elements.button("Save")).toBeDisabled();
  });

  test("must put the draft back as it was when the user cancels an edit", async () => {
    const { fake, render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Edit"));
    await user.type(elements.textbox("Draft comment"), " And why cache?");

    await user.click(elements.button("Cancel"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Why 24h?")).toBeInTheDocument();
    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h?");
  });

  test("must delete a new comment when the user discards its draft", async () => {
    const { fake, render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Edit"));

    await user.click(elements.button("Discard"));

    expect(fake.snapshot.threads).toEqual([]);
  });

  test("must remove only the reply when the user discards a draft reply", async () => {
    const { fake, render } = setUpTest({ thread: draftReply });
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Edit"));

    await user.click(elements.button("Discard"));

    expect(fake.snapshot.threads).toHaveLength(1);
    expect(fake.snapshot.threads[0]?.messages).toHaveLength(2);
    expect(fake.snapshot.threads[0]?.draft).toBeUndefined();
  });

  test("must resolve the thread when the user resolves it", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Resolve"));

    expect(fake.snapshot.threads[0]?.status).toBe("resolved");
  });

  test("must mark the thread resolved when it is resolved", () => {
    const { render } = setUpTest({ thread: { ...conversation, status: "resolved" } });

    render();

    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  test("must show why and keep the text when the server refuses the reply", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    fake.api.writeDraft.mockRejectedValueOnce(new ReviewApiError(409, "invalid-file", "review.json is not valid"));
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save"));

    expect(await screen.findByRole("alert")).toHaveTextContent("review.json is not valid");
    expect(elements.textbox("Reply")).toHaveValue("Hourly, then");
  });

  test("must not let the user save a reply when it is blank", async () => {
    const { render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "   ");

    expect(elements.button("Save")).toBeDisabled();
  });

  test("must ask to show the thread in its doc when the user clicks where it is", async () => {
    const { onSelect, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("#1 Line 3"));

    expect(onSelect).toHaveBeenCalledWith(conversation);
  });

  test("must mark the thread when the agent has written since the user last viewed it", () => {
    const { render } = setUpTest({ hasNewAgentMessage: true, thread: conversation });

    render();

    expect(screen.getByText("New reply")).toBeInTheDocument();
  });
});

function setUpTest({ hasNewAgentMessage = false, thread }: { hasNewAgentMessage?: boolean; thread: Thread }) {
  const fake = createFakeReviewApi({ threads: [thread] });
  const onChanged = vi.fn();
  const onSelect = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
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
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onSelect, render };
}

const elements = {
  actions: (): string[] =>
    within(screen.getByRole("article"))
      .getAllByRole("button")
      .map((button) => button.textContent ?? "")
      .filter((name) => !name.startsWith("#")),
  button: (name: string) => screen.getByRole("button", { name }),
  textbox: (name: string) => screen.getByRole("textbox", { name }),
};
```

- [ ] **Step 3: Rewrite the sidebar tests for the header and the composer**

Replace `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx` with:

```tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { CommentEditorHarness } from "../../testing/CommentEditorHarness";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadSidebar } from "./ThreadSidebar";

const agentReply = { at: "2026-10-08T09:05:00.000Z", author: "agent" as const, body: "Changed to 1h" };

const threads: Thread[] = [
  buildThread({
    anchor: buildPassageAnchor(),
    draft: { at: testTime, body: "Why 24h?" },
    id: 1,
    messages: [],
    status: "draft",
  }),
  buildThread({ anchor: buildPassageAnchor({ startOffset: 40 }), id: 2 }),
  buildThread({ anchor: buildPassageAnchor({ outdated: true }), id: 3 }),
  buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, id: 4, status: "resolved" }),
  buildThread({ anchor: { kind: "review" }, id: 5 }),
  buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), id: 6 }),
];

describe("ThreadSidebar", () => {
  test("must group this doc's threads and the review's into drafts, open, outdated and resolved", () => {
    const { render } = setUpTest();

    render();

    expect(elements.groupTitles()).toEqual(["Drafts 1", "Open 2", "Outdated 1", "Resolved 1"]);
    expect(elements.threadsIn("Drafts")).toEqual(["Thread #1"]);
    expect(elements.threadsIn("Open")).toEqual(["Thread #5", "Thread #2"]);
    expect(elements.threadsIn("Outdated")).toEqual(["Thread #3"]);
    expect(elements.threadsIn("Resolved")).toEqual(["Thread #4"]);
  });

  test("must keep resolved threads folded away when the sidebar opens", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("article", { name: "Thread #4" })).not.toBeVisible();
  });

  test("must show every doc's threads under their doc when the user chooses All docs", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("radio", { name: "All docs" }));

    const open = within(screen.getByRole("region", { name: "Open" }));
    expect(open.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Whole review",
      "docs/plan.md",
      "docs/spec.md",
    ]);
    expect(elements.threadsIn("Open")).toEqual(["Thread #5", "Thread #2", "Thread #6"]);
  });

  test("must save a comment on the whole review as a draft when the user starts one from + Comment", async () => {
    const { fake, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "+ Comment" }));
    await user.click(screen.getByRole("button", { name: "On the whole review" }));
    await user.keyboard("The spec and plan disagree.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fake.snapshot.threads).toMatchObject([
      { anchor: { kind: "review" }, draft: { body: "The spec and plan disagree." }, status: "draft" },
    ]);
    expect(screen.queryByRole("region", { name: "New comment" })).not.toBeInTheDocument();
  });

  test("must start a comment on the whole doc, with its text box ready, when the user picks On this doc", async () => {
    const { render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "+ Comment" }));
    await user.click(screen.getByRole("button", { name: "On this doc" }));

    const composer = within(screen.getByRole("region", { name: "New comment" }));
    expect(composer.getByText("Whole doc")).toBeInTheDocument();
    expect(composer.getByRole("textbox", { name: "Comment on the whole doc" })).toHaveFocus();
  });

  test("must start a comment on the whole review straight away when the docs list is on screen", async () => {
    const { render } = setUpTest({ documentPath: null, threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "+ Review comment" }));

    expect(screen.getByRole("textbox", { name: "Comment on the whole review" })).toHaveFocus();
  });

  test("must close the composer without saving when the user cancels it", async () => {
    const { fake, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "+ Comment" }));
    await user.click(screen.getByRole("button", { name: "On the whole review" }));
    await user.keyboard("Never mind");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("region", { name: "New comment" })).not.toBeInTheDocument();
    expect(fake.snapshot.threads).toEqual([]);
  });

  test("must keep one editor open when the user starts a reply while editing a draft", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(within(elements.thread(2)).getByRole("textbox", { name: "Reply" })).toBeInTheDocument();
  });

  test("must stop marking the agent's reply as new when the user selects its thread", async () => {
    const replied = buildThread({
      anchor: buildPassageAnchor(),
      id: 2,
      messages: [...buildThread().messages, agentReply],
    });
    const { onSelectThread, render } = setUpTest({ threads: [replied] });
    const user = userEvent.setup();
    render();
    const card = within(elements.thread(2));
    const wasNew = card.queryByText("New reply") !== null;

    await user.click(card.getByRole("button", { name: "#2 Line 3" }));

    expect(wasNew).toBe(true);
    expect(card.queryByText("New reply")).not.toBeInTheDocument();
    expect(onSelectThread).toHaveBeenCalledWith(replied);
  });

  test("must say how to comment when there are no threads", () => {
    const { render } = setUpTest({ threads: [] });

    render();

    expect(
      screen.getByText("No comments yet. Select text in the doc, or press + beside a block, to comment on it.")
    ).toBeInTheDocument();
  });
});

function setUpTest({
  documentPath = "docs/plan.md",
  threads: shown = threads,
}: { documentPath?: string | null; threads?: Thread[] } = {}) {
  localStorage.clear();
  const fake = createFakeReviewApi({ threads: shown });
  const onChanged = vi.fn();
  const onSelectThread = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <CommentEditorHarness onChanged={onChanged} threads={shown}>
          {(editor) => (
            <ThreadSidebar
              documentPath={documentPath}
              editor={editor}
              onChanged={onChanged}
              onSelectThread={onSelectThread}
              selectedThreadId={null}
              threads={shown}
            />
          )}
        </CommentEditorHarness>
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onSelectThread, render };
}

const elements = {
  groupTitles: (): string[] => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
  thread: (id: number) => screen.getByRole("article", { name: `Thread #${id}` }),
  threadsIn: (group: string): string[] =>
    within(screen.getByRole("region", { name: group }))
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label") ?? ""),
};
```

- [ ] **Step 4: Update the App and DocumentView tests**

In `src/web/components/App/App.test.tsx`:

1. In `setUpTest`'s `render`, replace `await screen.findByRole("textbox", { name: "Comment on the whole review" });` with `await screen.findByRole("complementary", { name: "Comments" });`.
2. Replace the test `"must keep the user's unsent reply when the agent resolves the thread"` with:

```tsx
  test("must keep the user's unsent reply in view when the agent resolves the thread", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await startReply(user, "Half written");

    fake.snapshot.threads[0] = { ...planThread, status: "resolved" };
    fake.emit({ type: "threads-changed" });

    const resolved = within(await screen.findByRole("region", { name: "Resolved" }));
    expect(resolved.getByRole("textbox", { name: "Reply" })).toBeVisible();
    expect(resolved.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  });
```

3. In `"must save a comment on the selected text as a draft when the user writes one"`, change `screen.getByRole("button", { name: "Save draft" })` to `screen.getByRole("button", { name: "Save" })`.
4. Replace the test `"must open the comments when the user starts a comment on the doc"` with:

```tsx
  test("must open the comments when the user starts a comment in the doc", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await elements.article().findByText("Retries happen three times.");

    selectText(elements.article().getByText("Retries happen three times."), "Retries".length);
    await user.click(await screen.findByRole("button", { name: "Comment" }));

    expect(elements.panelToggle()).toHaveAttribute("aria-expanded", "true");
  });
```

In `src/web/components/DocumentView/DocumentView.test.tsx`, delete the tests `"must start a comment on the whole doc when the user asks to"` and `"must still offer a comment on the whole doc when the doc is empty"`. Comments on the whole doc now start from the sidebar.

- [ ] **Step 5: Update the end-to-end helpers and tests for the new labels**

In `src/e2e/testing/reviewTest.ts`, in `writeDraftComment`, replace `await page.getByRole("button", { name: "Save draft" }).click();` with:

```ts
  await page.getByRole("region", { name: "New comment" }).getByRole("button", { exact: true, name: "Save" }).click();
```

In `src/e2e/layout.e2e.ts`:

1. In `"must keep Submit and its menu in full view when the comments outgrow their column"`, replace the two lines inside the `for` loop that fill and add the review comment with:

```ts
    await page.getByRole("button", { name: "+ Comment" }).click();
    await page.getByRole("button", { name: "On the whole review" }).click();
    await page.keyboard.type(`Note ${count}`);
    await page.getByRole("button", { exact: true, name: "Save" }).click();
```

2. In `"must open the comments at a new comment when the user starts one in a narrow window, and keep its text while they are hidden"`, replace `await page.getByRole("button", { name: "Save draft" }).click();` with `await page.getByRole("button", { exact: true, name: "Save" }).click();`.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm test --project web src/web/components`
Expected: FAIL. `CommentEditorHarness` renders, but the cards still show text boxes for drafts, there is no **+ Comment** button, and `ThreadSidebar` does not take `editor`.

- [ ] **Step 7: Rewrite `CommentForm` as the open editor's form**

Replace `src/web/components/CommentForm/CommentForm.tsx` with:

```tsx
import { Alert, Button, Stack, Textarea } from "@krelborn/stylesui";
import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { describeFailure } from "../../api/describeFailure";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";

import styles from "./CommentForm.module.css";

export interface CommentFormProps {
  /**
   * Names the text box for screen readers
   */
  label: string;

  /**
   * Shown at the start of the row of buttons, away from Save, such as the button that discards a draft
   */
  leading?: ReactNode;
}

/**
 * The open comment editor: its text box, then Cancel and Save
 */
export function CommentForm({ label, leading }: CommentFormProps): JSX.Element {
  const editor = useCommentEditorContext();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { focusRevision } = editor;
  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusRevision]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await editor.save();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Stack as="form" gap={2} onSubmit={(event: FormEvent) => void submit(event)}>
      <Textarea
        onChange={(event) => editor.changeBody(event.target.value)}
        ref={textareaRef}
        rows={3}
        value={editor.body}
        aria-label={label}
      />
      {error !== null && (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      )}
      <div className={styles.buttons}>
        {leading !== undefined && <div className={styles.leading}>{leading}</div>}
        <Button onClick={editor.close} size="sm" variant="outline">
          Cancel
        </Button>
        <Button busy={isSaving} disabled={!editor.canSave} size="sm" type="submit">
          Save
        </Button>
      </div>
    </Stack>
  );
}
```

Create `src/web/components/CommentForm/CommentForm.module.css`:

```css
.buttons {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sui-space-2);
  justify-content: flex-end;
}

.leading {
  margin-inline-end: auto;
}
```

- [ ] **Step 8: Let a quote mark the comment being written**

Replace `src/web/components/Quote/Quote.tsx` with:

```tsx
import { clsx } from "clsx";
import type { JSX } from "react";

import styles from "./Quote.module.css";

export interface QuoteProps {
  /**
   * Whether this is the passage of the comment the user is writing, which draws its bar in the primary colour, as its
   * highlight in the doc is
   */
  isPending?: boolean;

  /**
   * The doc's text that a comment is on
   */
  text: string;
}

/**
 * The text a comment is on, cut short after a few lines
 */
export function Quote({ isPending = false, text }: QuoteProps): JSX.Element {
  return <blockquote className={clsx(styles.quote, { [styles.pending ?? ""]: isPending })}>{text}</blockquote>;
}
```

Append to `src/web/components/Quote/Quote.module.css`:

```css

.pending {
  border-inline-start-color: var(--sui-color-primary);
}
```

- [ ] **Step 9: Write the chevron, the + Comment menu and the header**

Create `src/web/components/ChevronDownIcon/ChevronDownIcon.tsx`:

```tsx
import type { JSX } from "react";

/**
 * A downward chevron for buttons that open a menu, drawn in the text colour and hidden from assistive technology
 */
export function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      fill="none"
      height="0.75em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      width="0.75em"
      aria-hidden={true}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
```

Create `src/web/components/NewCommentMenu/NewCommentMenu.tsx`:

```tsx
import { Button, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { NewComment } from "../../review/NewComment";
import { ChevronDownIcon } from "../ChevronDownIcon/ChevronDownIcon";

import styles from "./NewCommentMenu.module.css";

export interface NewCommentMenuProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called when the user starts a comment on the doc or on the whole review
   */
  onComment: (newComment: NewComment) => void;
}

/**
 * Starts a comment on the doc on screen or on the whole review, from a menu; on the docs list, where only the review
 * can take one, a button starts it directly
 */
export function NewCommentMenu({ documentPath, onComment }: NewCommentMenuProps): JSX.Element {
  const popover = usePopover();
  const start = (newComment: NewComment): void => {
    popover.close();
    onComment(newComment);
  };
  if (documentPath === null) {
    return (
      <Button onClick={() => onComment({ anchor: { kind: "review" } })} size="sm" variant="secondary">
        + Review comment
      </Button>
    );
  }
  return (
    <>
      <Button {...popover.getTriggerProps()} size="sm" variant="secondary">
        + Comment <ChevronDownIcon />
      </Button>
      <Popover {...popover.getOverlayProps()}>
        <Stack gap={1}>
          <Button
            className={styles.item}
            onClick={() => start({ anchor: { document: documentPath, kind: "document" } })}
            size="sm"
            variant="ghost"
          >
            <span className={styles.itemText}>
              On this doc
              <Text size="xs" tone="muted" aria-hidden={true}>
                {documentPath}
              </Text>
            </span>
          </Button>
          <Button
            className={styles.item}
            onClick={() => start({ anchor: { kind: "review" } })}
            size="sm"
            variant="ghost"
          >
            <span className={styles.itemText}>
              On the whole review
              <Text size="xs" tone="muted" aria-hidden={true}>
                Every doc in this review
              </Text>
            </span>
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
```

Create `src/web/components/NewCommentMenu/NewCommentMenu.module.css`:

```css
.item {
  inline-size: 100%;
  justify-content: flex-start;
}

.itemText {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  text-align: start;
}
```

Create `src/web/components/CommentsHeader/CommentsHeader.tsx`:

```tsx
import type { JSX, ReactNode } from "react";

import type { NewComment } from "../../review/NewComment";
import { NewCommentMenu } from "../NewCommentMenu/NewCommentMenu";

import styles from "./CommentsHeader.module.css";

export interface CommentsHeaderProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called when the user starts a comment on the doc or on the whole review
   */
  onComment: (newComment: NewComment) => void;

  /**
   * The start of the header, such as the title and its count
   */
  title: ReactNode;
}

/**
 * The top of the comments: their title, and the button that starts a comment on the doc or on the whole review
 */
export function CommentsHeader({ documentPath, onComment, title }: CommentsHeaderProps): JSX.Element {
  return (
    <div className={styles.header}>
      <div className={styles.title}>{title}</div>
      <NewCommentMenu documentPath={documentPath} onComment={onComment} />
    </div>
  );
}
```

Create `src/web/components/CommentsHeader/CommentsHeader.module.css`:

```css
.header {
  align-items: center;
  display: flex;
  gap: var(--sui-space-2);
  justify-content: space-between;
}

.title {
  min-inline-size: 0;
}
```

- [ ] **Step 10: Rewrite the composer**

Replace `src/web/components/ThreadSidebar/NewCommentForm.tsx` with:

```tsx
import { Card, Cluster, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { NewComment } from "../../review/NewComment";
import { CommentForm } from "../CommentForm/CommentForm";
import { Quote } from "../Quote/Quote";

import styles from "./NewCommentForm.module.css";

export interface NewCommentFormProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  newComment: NewComment;
}

/**
 * The composer for a comment the user has started: what it is on, and the editor
 */
export function NewCommentForm({ documentPath, newComment: { anchor } }: NewCommentFormProps): JSX.Element {
  const location = locationOf(anchor, documentPath);
  return (
    <Card as="section" className={styles.composer} padding="sm" aria-label="New comment">
      <Stack gap={2}>
        <Cluster gap={2} justify="between">
          <Text size="sm" weight="bold">
            New comment
          </Text>
          {location !== null && (
            <Text size="sm" tone="muted">
              {location}
            </Text>
          )}
        </Cluster>
        {anchor.kind === "passage" && <Quote isPending={true} text={anchor.quote} />}
        <CommentForm label={labelOf(anchor)} />
      </Stack>
    </Card>
  );
}

function locationOf(anchor: NewComment["anchor"], documentPath: string | null): string | null {
  if (anchor.kind === "review") {
    return "Whole review";
  }
  if (anchor.document !== documentPath) {
    return anchor.document;
  }
  return anchor.kind === "document" ? "Whole doc" : null;
}

function labelOf(anchor: NewComment["anchor"]): string {
  switch (anchor.kind) {
    case "review":
      return "Comment on the whole review";
    case "document":
      return "Comment on the whole doc";
    case "passage":
      return "Comment";
  }
}
```

Create `src/web/components/ThreadSidebar/NewCommentForm.module.css`:

```css
/* The ring marks the one editor that is open */
.composer {
  --sui-card-bg: var(--sui-color-background);
  --sui-card-border: var(--sui-color-primary);
  --sui-card-shadow: 0 0 0 3px var(--sui-color-primary-subtle);
}
```

- [ ] **Step 11: Show the draft read-only, and its editor in its place**

Replace `src/web/components/ThreadCard/ThreadActions.tsx` with:

```tsx
import { Alert, Button, Cluster, Divider, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";
import { CommentForm } from "../CommentForm/CommentForm";

import { Message } from "./Message";
import styles from "./ThreadCard.module.css";

export interface ThreadActionsProps {
  /**
   * Called after an action changes the thread on the server
   */
  onChanged: () => void;

  thread: Thread;
}

/**
 * The user's part in a thread: their draft, or its editor while they write, and what they can do next
 */
export function ThreadActions({ onChanged, thread }: ThreadActionsProps): JSX.Element {
  const api = useReviewApi();
  const editor = useCommentEditorContext();
  const [error, setError] = useState<string | null>(null);
  const { draft, id, status } = thread;
  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
      setError(null);
      onChanged();
    } catch (failure) {
      setError(describeFailure(failure));
    }
  };
  const refusal = error !== null && (
    <Alert role="alert" tone="danger">
      {error}
    </Alert>
  );
  if (editor.editingThreadId === id) {
    const discard = async (): Promise<void> => {
      await api.deleteDraft(id);
      editor.close();
    };
    return (
      <>
        <CommentForm
          label={editorLabelOf(thread)}
          leading={
            draft === undefined ? undefined : (
              <Button onClick={() => void run(discard)} size="sm" variant="outline">
                Discard
              </Button>
            )
          }
        />
        {refusal}
      </>
    );
  }
  return (
    <Stack gap={2}>
      {draft !== undefined && <SavedDraft body={draft.body} isReply={status !== "draft"} />}
      <Cluster gap={2} justify="end">
        {status === "open" && (
          <Button onClick={() => void run(() => api.resolveThread(id))} size="sm" variant="outline">
            Resolve
          </Button>
        )}
        <Button onClick={() => editor.request({ kind: "thread", threadId: id })} size="sm" variant="secondary">
          {draft === undefined ? "Reply" : "Edit"}
        </Button>
      </Cluster>
      {refusal}
    </Stack>
  );
}

function SavedDraft({ body, isReply }: { body: string; isReply: boolean }): JSX.Element {
  if (!isReply) {
    return (
      <Text as="p" className={styles.body} size="sm">
        {body}
      </Text>
    );
  }
  return (
    <>
      <Divider />
      <Message author="user" body={body} sentAt={null} />
    </>
  );
}

function editorLabelOf({ draft, status }: Thread): string {
  if (status === "draft") {
    return "Draft comment";
  }
  return draft === undefined ? "Reply" : "Draft reply";
}
```

In `src/web/components/ThreadCard/ThreadCard.tsx`:

1. Add `import { useCommentEditorContext } from "../../review/useCommentEditorContext";` after the `describeLocation` import.
2. Add `const editor = useCommentEditorContext();` after `const cardRef = useRef<HTMLElement>(null);`.
3. Change the card's `className` to:

```tsx
      className={clsx(styles.card, {
        [styles.editing ?? ""]: editor.editingThreadId === id,
        [styles.selected ?? ""]: isSelected,
      })}
```

In `src/web/components/ThreadCard/ThreadCard.module.css`, add after the `.selected` rule:

```css

/* The ring marks the one editor that is open */
.editing {
  --sui-card-border: var(--sui-color-primary);
  --sui-card-shadow: 0 0 0 3px var(--sui-color-primary-subtle);
}
```

- [ ] **Step 12: Rewrite `ThreadSidebar` around the editor and the header**

Replace `src/web/components/ThreadSidebar/ThreadSidebar.tsx` with:

```tsx
import { Counter, Segment, SegmentedControl, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { CommentEditorContext } from "../../review/CommentEditorContext";
import { groupThreads } from "../../review/groupThreads";
import type { CommentEditor } from "../../review/useCommentEditor";
import { useSeenMessages } from "../../review/useSeenMessages";
import { CommentsHeader } from "../CommentsHeader/CommentsHeader";

import { NewCommentForm } from "./NewCommentForm";
import { ThreadGroup } from "./ThreadGroup";

export interface ThreadSidebarProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * The page's comment editor, which the sidebar shows as the composer or inside the card of the thread it writes to
   */
  editor: CommentEditor;

  /**
   * Called after the sidebar changes threads on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see a thread in its doc
   */
  onSelectThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Every thread in the repo
   */
  threads: Thread[];
}

/**
 * The comments beside the doc: a header that starts comments on the doc or the review, the composer while the user
 * writes one, and the threads grouped as drafts, open, outdated and resolved, for this doc or for every doc
 */
export function ThreadSidebar({
  documentPath,
  editor,
  onChanged,
  onSelectThread,
  selectedThreadId,
  threads,
}: ThreadSidebarProps): JSX.Element {
  const seen = useSeenMessages();
  const [scope, setScope] = useState("document");
  const showsEveryDocument = documentPath === null || scope === "all";
  const visible = showsEveryDocument
    ? threads
    : threads.filter((thread) => thread.anchor.kind === "review" || thread.anchor.document === documentPath);
  const groups = groupThreads(visible);
  const listProps = {
    hasNewAgentMessage: seen.hasNewAgentMessage,
    onChanged,
    onSelect: (thread: Thread) => {
      seen.markSeen(thread);
      onSelectThread(thread);
    },
    selectedThreadId,
    showsDocuments: showsEveryDocument,
  };
  return (
    <CommentEditorContext value={editor}>
      <Stack as="aside" gap={4} aria-label="Comments">
        <CommentsHeader
          documentPath={documentPath}
          onComment={(comment) => editor.request({ comment, kind: "new" })}
          title={
            <Text weight="bold">
              Comments <Counter count={visible.length} />
            </Text>
          }
        />
        {editor.newComment !== null && (
          <NewCommentForm
            documentPath={documentPath}
            key={JSON.stringify(editor.newComment.anchor)}
            newComment={editor.newComment}
          />
        )}
        {documentPath !== null && (
          <SegmentedControl label="Show comments on" onValueChange={setScope} size="sm" value={scope}>
            <Segment value="document">This doc</Segment>
            <Segment value="all">All docs</Segment>
          </SegmentedControl>
        )}
        {visible.length === 0 && (
          <Text as="p" size="sm" tone="muted">
            No comments yet. Select text in the doc, or press + beside a block, to comment on it.
          </Text>
        )}
        <ThreadGroup isFolded={false} threads={groups.drafts} title="Drafts" {...listProps} />
        <ThreadGroup isFolded={false} threads={groups.open} title="Open" {...listProps} />
        <ThreadGroup isFolded={false} threads={groups.outdated} title="Outdated" {...listProps} />
        <ThreadGroup
          isFolded={!groups.resolved.some((thread) => thread.id === editor.editingThreadId)}
          threads={groups.resolved}
          title="Resolved"
          {...listProps}
        />
      </Stack>
    </CommentEditorContext>
  );
}
```

The Resolved group opens while it holds the thread being edited, so a reply the agent's resolve moves there stays in view.

- [ ] **Step 13: Run the editor from `App`, and take the doc comment button out of the doc**

In `src/web/components/App/App.tsx`:

1. Change `import { useMemo, useRef, useState } from "react";` to `import { useMemo, useRef } from "react";`.
2. Add `import { useCommentEditor } from "../../review/useCommentEditor";` after the `NewComment` type import.
3. Delete `const [newComment, setNewComment] = useState<NewComment | null>(null);`.
4. Directly after the `documentThreads` `useMemo`, add:

```tsx
  const editor = useCommentEditor({ onChanged: threads.refresh, threads: allThreads });
```

5. Change `startComment`'s body to:

```tsx
    editor.request({ comment, kind: "new" });
    openPanel();
```

6. In the `ThreadSidebar` element, replace the `newComment={newComment}` and `onCloseNewComment={() => setNewComment(null)}` props with `editor={editor}`. Keep the props in alphabetical order: `documentPath`, `editor`, `onChanged`, `onSelectThread`, `selectedThreadId`, `threads`.

In `src/web/components/DocumentView/DocumentView.tsx`:

1. Change the StylesUI import to `import { Alert, Prose, Stack } from "@krelborn/stylesui";`.
2. Delete the `<Button … >Comment on this doc</Button>` element at the top of the returned `Stack`.
3. Change the doc comment on `onComment` in `DocumentViewProps` to `Called when the user starts a comment on a passage or a block`.

In `src/web/components/DocumentView/DocumentView.module.css`, delete the `.documentButton` rule.

Delete `src/web/review/UnsentTextContext.ts` and `src/web/review/useUnsentText.ts`:

```bash
git rm src/web/review/UnsentTextContext.ts src/web/review/useUnsentText.ts
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `pnpm test --project web`
Expected: PASS.

Run: `pnpm test:e2e`
Expected: PASS in Chromium and WebKit.

- [ ] **Step 15: Look at it**

Follow "Visual checks" in Global Constraints. Check these in light and dark mode:
- the panel starts with "Comments" and **+ Comment**, with no review box
- **+ Comment** opens a two-item menu, each item with a muted line beneath it
- a new comment opens at the top, with a primary ring and right-aligned buttons, Cancel then Save
- a draft shows as text with Edit
- editing a draft rings its card and shows Discard on the left
- only one text box is ever on screen

- [ ] **Step 16: Check, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm format && pnpm exec fallow audit`
Expected: no lint or type errors; fallow's verdict is not `fail`. If fallow reports `ThreadSidebar` above cognitive 15, move the `listProps` object and the four `ThreadGroup` elements into a local `ThreadGroups` component in the same file, which takes `threads` and `editingThreadId`. Task 5 replaces this part of the file anyway.

```bash
git add -A src/web src/e2e
git commit -m "Open one comment editor at a time, show drafts as text until the user edits them, and start doc and review comments from + Comment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ask before unsaved text is lost, and save and close from the keyboard

**Files:**
- Modify: `src/web/review/useCommentEditor.ts` (full rewrite)
- Create: `src/web/review/useLeavePageWarning.ts`
- Create: `src/web/components/CommentForm/CommentFormButtons.tsx`, `UnsavedQuestion.tsx`, `useEditorKeys.ts`, `SaveShortcutHint.tsx`
- Modify: `src/web/components/CommentForm/CommentForm.tsx`, `src/web/components/ThreadSidebar/NewCommentForm.tsx`
- Test: `src/web/review/useCommentEditor.test.tsx`, `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`, `src/web/components/App/App.test.tsx`

**Interfaces:**
- Consumes: everything Task 3 produced.
- Produces:
  - `CommentEditor` gains:

    | Member | Type |
    | --- | --- |
    | `discardChanges` | `() => void` |
    | `escape` | `() => void` |
    | `keepEditing` | `() => void` |
    | `question` | `EditorQuestion \| null` |

  - New exported types: `type HeldRequest = { kind: "comment" } | { kind: "edit"; threadId: number } | { kind: "reply"; threadId: number }` and `interface EditorQuestion { held: HeldRequest | null }`.
  - `request` now asks first when the open editor holds unsaved text. `save` opens the request on hold once it succeeds.
  - `useLeavePageWarning(shouldWarn: boolean): void`.
  - `CommentForm`'s props are unchanged.

- [ ] **Step 1: Write the failing hook tests**

In `src/web/review/useCommentEditor.test.tsx`:

1. Keep the `EditorTarget` import, and replace the `useCommentEditor` import with:

```tsx
import type { HeldRequest } from "./useCommentEditor";
import { useCommentEditor } from "./useCommentEditor";
```

2. Replace the test `"must open the new editor in place of the open one when the user starts another"` with:

```tsx
  test("must open another editor at once when the open one holds nothing unsaved", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));

    act(() => result.current.request(editDraft));

    expect(result.current).toMatchObject({ body: "Why 24h?", editingThreadId: 1, question: null });
  });

  test.each<{ condition: string; expected: HeldRequest; target: EditorTarget }>([
    {
      condition: "another comment",
      expected: { kind: "comment" },
      target: { comment: { anchor: { document: "docs/plan.md", kind: "document" } }, kind: "new" },
    },
    { condition: "a reply", expected: { kind: "reply", threadId: 2 }, target: reply },
    { condition: "an edit of a draft", expected: { kind: "edit", threadId: 1 }, target: editDraft },
  ])(
    "must keep the open editor and ask about its text when the user starts $condition while it holds unsaved text",
    ({ expected, target }) => {
      const { render } = setUpTest();
      const { result } = render();
      act(() => result.current.request(reviewComment));
      act(() => result.current.changeBody("Overall?"));

      act(() => result.current.request(target));

      expect(result.current).toMatchObject({
        body: "Overall?",
        newComment: { anchor: { kind: "review" } },
        question: { held: expected },
      });
    }
  );

  test("must save the text, then open the request on hold, when the user answers Save", async () => {
    const { fake, render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.request(editDraft));

    await act(() => result.current.save());

    expect(fake.snapshot.threads[1]?.draft?.body).toBe("Hourly");
    expect(result.current).toMatchObject({ body: "Why 24h?", editingThreadId: 1, question: null });
  });

  test("must throw the text away, then open the request on hold, when the user discards it", () => {
    const { fake, render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.request(editDraft));

    act(() => result.current.discardChanges());

    expect(fake.snapshot.threads[1]?.draft).toBeUndefined();
    expect(result.current).toMatchObject({ editingThreadId: 1, question: null });
  });

  test("must leave a draft's saved text as it was when the user discards their changes to it", () => {
    const { fake, render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(editDraft));
    act(() => result.current.changeBody("Why 1h?"));
    act(() => result.current.request(reply));

    act(() => result.current.discardChanges());

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h?");
    expect(result.current.editingThreadId).toBe(2);
  });

  test("must drop the request on hold and keep the text when the user keeps editing", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.request(editDraft));

    act(() => result.current.keepEditing());

    expect(result.current).toMatchObject({ body: "Hourly", editingThreadId: 2, question: null });
  });

  test("must drop the request on hold and keep the text when saving fails", async () => {
    const { fake, render } = setUpTest();
    fake.api.writeDraft.mockRejectedValueOnce(new ReviewApiError(409, "invalid-file", "review.json is not valid"));
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.request(editDraft));

    await act(() => expect(result.current.save()).rejects.toThrow("review.json is not valid"));

    expect(result.current).toMatchObject({ body: "Hourly", editingThreadId: 2, question: null });
  });

  test("must hold only the latest request when the user starts yet another while asked", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.request(editDraft));

    act(() => result.current.request(reviewComment));

    expect(result.current.question).toEqual({ held: { kind: "comment" } });
  });

  test("must close the editor when the user presses Escape with nothing unsaved", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));

    act(() => result.current.escape());

    expect(result.current.editingThreadId).toBeNull();
  });

  test("must ask about the text, then keep editing, when the user presses Escape twice with unsaved text", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));

    act(() => result.current.escape());
    const question = result.current.question;
    act(() => result.current.escape());

    expect(question).toEqual({ held: null });
    expect(result.current).toMatchObject({ body: "Hourly", editingThreadId: 2, question: null });
  });

  test("must close the editor when the user discards after pressing Escape", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.escape());

    act(() => result.current.discardChanges());

    expect(result.current.editingThreadId).toBeNull();
  });

  test.each([
    { condition: "the editor holds unsaved text", expected: true, text: "Hourly" },
    { condition: "the editor holds nothing unsaved", expected: false, text: "" },
  ])("must ask the browser to warn before the page closes as $expected when $condition", ({ expected, text }) => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody(text));

    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);

    expect(leaving.defaultPrevented).toBe(expected);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test --project web src/web/review/useCommentEditor.test.tsx`
Expected: FAIL. TypeScript reports that `useCommentEditor` exports no `HeldRequest`. At run time the new tests fail on `question`, `discardChanges`, `keepEditing` and `escape` being undefined.

- [ ] **Step 3: Write `useLeavePageWarning`**

Create `src/web/review/useLeavePageWarning.ts`:

```ts
import { useEffect } from "react";

/**
 * Has the browser warn the user before they close or reload the page
 *
 * @param shouldWarn whether to warn, such as while the user has text they have not saved
 */
export function useLeavePageWarning(shouldWarn: boolean): void {
  useEffect(() => {
    if (!shouldWarn) {
      return;
    }
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [shouldWarn]);
}
```

- [ ] **Step 4: Rewrite `useCommentEditor` with the question**

Replace `src/web/review/useCommentEditor.ts` with:

```ts
import { useState } from "react";

import type { Thread } from "../../shared/review/threadSchema";
import { useReviewApi } from "../api/useReviewApi";

import type { EditorTarget } from "./EditorTarget";
import type { NewComment } from "./NewComment";
import { useLeavePageWarning } from "./useLeavePageWarning";

interface CommentEditorOptions {
  /**
   * Called after the editor saves to the server
   */
  onChanged: () => void;

  /**
   * Every thread in the repo
   */
  threads: readonly Thread[];
}

/**
 * A request the editor holds while it asks about its unsaved text: another new comment, a reply to a thread, or an
 * edit of a thread's draft
 */
export type HeldRequest = { kind: "comment" } | { kind: "edit"; threadId: number } | { kind: "reply"; threadId: number };

export interface EditorQuestion {
  /**
   * The request waiting on the answer, or null when the user pressed Escape
   */
  held: HeldRequest | null;
}

export interface CommentEditor {
  /**
   * The open editor's text
   */
  body: string;

  /**
   * Whether Save would save anything: the text is unsaved and not blank
   */
  canSave: boolean;

  /**
   * Replaces the open editor's text
   */
  changeBody: (body: string) => void;

  /**
   * Closes the open editor, throwing away any unsaved text
   */
  close: () => void;

  /**
   * Answers the question by throwing away the unsaved text, which leaves a saved draft as it was, then opens the
   * request on hold, or closes the editor when nothing is on hold
   */
  discardChanges: () => void;

  /**
   * The thread whose reply or draft the open editor writes, or null
   */
  editingThreadId: number | null;

  /**
   * Answers Escape: closes an editor with nothing unsaved, asks about unsaved text, or keeps editing when already
   * asking
   */
  escape: () => void;

  /**
   * Changes each time the open editor's text box should take focus: when it opens, when the user asks for it again,
   * and when they keep editing
   */
  focusRevision: number;

  /**
   * Whether the open editor holds text that is not saved: for a new comment or reply, any text that is not blank; for a
   * draft, text that differs from the saved draft
   */
  hasUnsavedText: boolean;

  /**
   * Answers the question by dropping the request on hold and going back to the text
   */
  keepEditing: () => void;

  /**
   * The comment the open editor starts, or null when it writes to a thread
   */
  newComment: NewComment | null;

  /**
   * What the open editor asks while it holds unsaved text the user might lose, or null when it is not asking
   */
  question: EditorQuestion | null;

  /**
   * Asks for an editor on the target. It opens at once when the open editor holds nothing unsaved, and takes focus
   * when it is the open editor. Otherwise it waits while the open editor asks what to do with its text.
   */
  request: (target: EditorTarget) => void;

  /**
   * Saves the open editor's text, as a new draft thread or as its thread's draft, then opens the request on hold, or
   * closes the editor when nothing is on hold; does nothing when there is nothing to save
   *
   * @returns a promise that rejects with the server's refusal, which leaves the editor open with its text and drops
   *   the request on hold
   */
  save: () => Promise<void>;

  /**
   * The open editor's saved draft, or null when it writes a new comment or a new reply
   */
  savedBody: string | null;
}

interface OpenEditor {
  body: string;

  /**
   * Whether its thread had a draft when it opened, so that it closes once that draft is gone
   */
  hadDraft: boolean;

  /**
   * The question the editor is asking, holding the request that waits on it, or null when it is not asking
   */
  question: { held: EditorTarget | null } | null;

  target: EditorTarget;
}

interface EditorState {
  focusRevision: number;
  open: OpenEditor | null;
}

/**
 * The one comment editor on the page: what it writes, its text, saving it, and what to do with unsaved text when the
 * user asks for another editor
 *
 * @returns the editor; it closes by itself when the thread it writes to disappears, or loses the draft it was editing
 */
export function useCommentEditor({ onChanged, threads }: CommentEditorOptions): CommentEditor {
  const api = useReviewApi();
  const [state, setState] = useState<EditorState>({ focusRevision: 0, open: null });
  const open = state.open !== null && isStillOpen(state.open, threads) ? state.open : null;
  const savedBody = open === null ? null : savedBodyOf(open.target, threads);
  const hasUnsavedText = open !== null && differsFromSaved(open.body, savedBody);
  const canSave = open !== null && hasUnsavedText && open.body.trim() !== "";
  useLeavePageWarning(hasUnsavedText);
  const show = (next: OpenEditor | null): void => {
    setState(({ focusRevision }) => ({ focusRevision: focusRevision + 1, open: next }));
  };
  const update = (change: Partial<OpenEditor>): void => {
    setState((current) => ({ ...current, open: current.open && { ...current.open, ...change } }));
  };
  const openHeldRequest = (): void => {
    const held = open?.question?.held ?? null;
    show(held === null ? null : editorFor(held, threads));
  };
  const keepEditing = (): void => show(open && { ...open, question: null });
  const save = async (): Promise<void> => {
    if (open === null || !canSave) {
      return;
    }
    const { body, target } = open;
    try {
      await (target.kind === "new"
        ? api.createThread({ ...target.comment, body })
        : api.writeDraft(target.threadId, body));
    } catch (failure) {
      update({ question: null });
      throw failure;
    }
    onChanged();
    openHeldRequest();
  };
  return {
    body: open?.body ?? "",
    canSave,
    changeBody: (body) => update({ body }),
    close: () => show(null),
    discardChanges: openHeldRequest,
    editingThreadId: threadIdOf(open),
    escape: () => {
      if (!hasUnsavedText) {
        show(null);
      } else if (open?.question === null) {
        update({ question: { held: null } });
      } else {
        keepEditing();
      }
    },
    focusRevision: state.focusRevision,
    hasUnsavedText,
    keepEditing,
    newComment: newCommentOf(open),
    question: questionOf(open, threads),
    request: (target) => {
      if (open !== null && isSameTarget(open.target, target)) {
        show(open);
      } else if (hasUnsavedText) {
        update({ question: { held: target } });
      } else {
        show(editorFor(target, threads));
      }
    },
    save,
    savedBody,
  };
}

function editorFor(target: EditorTarget, threads: readonly Thread[]): OpenEditor {
  const savedBody = savedBodyOf(target, threads);
  return { body: savedBody ?? "", hadDraft: savedBody !== null, question: null, target };
}

function questionOf(open: OpenEditor | null, threads: readonly Thread[]): EditorQuestion | null {
  if (open === null || open.question === null) {
    return null;
  }
  const { held } = open.question;
  if (held === null) {
    return { held: null };
  }
  if (held.kind === "new") {
    return { held: { kind: "comment" } };
  }
  return { held: { kind: savedBodyOf(held, threads) === null ? "reply" : "edit", threadId: held.threadId } };
}

function savedBodyOf(target: EditorTarget, threads: readonly Thread[]): string | null {
  return target.kind === "thread" ? (threadOf(target.threadId, threads)?.draft?.body ?? null) : null;
}

function isStillOpen({ hadDraft, target }: OpenEditor, threads: readonly Thread[]): boolean {
  if (target.kind === "new") {
    return true;
  }
  const thread = threadOf(target.threadId, threads);
  return thread !== undefined && (!hadDraft || thread.draft !== undefined);
}

function differsFromSaved(body: string, savedBody: string | null): boolean {
  return savedBody === null ? body.trim() !== "" : body !== savedBody;
}

function isSameTarget(left: EditorTarget, right: EditorTarget): boolean {
  if (left.kind === "thread" && right.kind === "thread") {
    return left.threadId === right.threadId;
  }
  if (left.kind === "new" && right.kind === "new") {
    return JSON.stringify(left.comment.anchor) === JSON.stringify(right.comment.anchor);
  }
  return false;
}

function newCommentOf(open: OpenEditor | null): NewComment | null {
  return open !== null && open.target.kind === "new" ? open.target.comment : null;
}

function threadIdOf(open: OpenEditor | null): number | null {
  return open !== null && open.target.kind === "thread" ? open.target.threadId : null;
}

function threadOf(threadId: number, threads: readonly Thread[]): Thread | undefined {
  return threads.find((thread) => thread.id === threadId);
}
```

- [ ] **Step 5: Run the hook tests to verify they pass**

Run: `pnpm test --project web src/web/review/useCommentEditor.test.tsx`
Expected: PASS, 34 tests.

- [ ] **Step 6: Write the failing tests for the question in the panel**

In `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`:

1. Change the Testing Library import to `import { render as renderBase, screen, waitFor, within } from "@testing-library/react";`.
2. Add these tests at the end of the `describe` block:

```tsx
  test("must ask what to do with a reply's text, and say what waits, when the user starts editing a draft", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");

    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Save this comment first?");
    expect(screen.getByRole("alert")).toHaveTextContent("You started editing #1.");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  test("must save the reply and open the draft when the user answers Save", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("textbox", { name: "Draft comment" })).toHaveValue("Why 24h?");
    expect(fake.snapshot.threads[1]?.draft?.body).toBe("Hourly");
  });

  test("must throw the reply away and open the draft when the user answers Discard", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByRole("textbox", { name: "Draft comment" })).toHaveValue("Why 24h?");
    expect(fake.snapshot.threads[1]?.draft).toBeUndefined();
  });

  test("must keep the reply and go back to it when the user keeps editing", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Hourly");
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveFocus();
  });

  test("must offer to discard only the changes when the user has edited a saved draft", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("textbox", { name: "Draft comment" }), " Or 1h?");
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Save your changes first?");

    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(within(elements.thread(1)).getByText("Why 24h?")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveFocus();
    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h?");
  });

  test("must let the user only discard or keep editing when they cleared a draft and start another comment", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Draft comment" }));

    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h?");
  });

  test("must close an editor with nothing unsaved when the user presses Escape", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("must ask about unsaved text, then keep editing, when the user presses Escape twice", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");

    await user.keyboard("{Escape}");
    const question = screen.getByRole("alert");
    expect(question).toHaveTextContent("Save this comment?");
    expect(question).not.toHaveTextContent("You started");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Hourly");
  });

  test.each([
    { keys: "{Meta>}{Enter}{/Meta}", shortcut: "Cmd+Enter" },
    { keys: "{Control>}{Enter}{/Control}", shortcut: "Ctrl+Enter" },
  ])("must save the reply when the user presses $shortcut", async ({ keys }) => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");

    await user.keyboard(keys);

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
    expect(fake.snapshot.threads[1]?.draft?.body).toBe("Hourly");
  });

  test("must save nothing and keep the reply open when the user presses Cmd+Enter in an empty reply", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("");
    expect(fake.snapshot.threads[1]?.draft).toBeUndefined();
  });

  test("must tell the user how to save from the keyboard when they start a comment", async () => {
    const { render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "+ Comment" }));
    await user.click(screen.getByRole("button", { name: "On the whole review" }));

    expect(within(screen.getByRole("region", { name: "New comment" })).getByText("to save")).toBeInTheDocument();
  });
```

3. Add this helper after `setUpTest`:

```tsx
async function startReplyOnThread(
  user: ReturnType<typeof userEvent.setup>,
  threadId: number,
  text: string
): Promise<void> {
  await user.click(within(elements.thread(threadId)).getByRole("button", { name: "Reply" }));
  await user.keyboard(text);
}
```

In `src/web/components/App/App.test.tsx`, add these tests after `"must save a comment on the selected text as a draft when the user writes one"`:

```tsx
  test("must ask about the user's unsent reply, then save it and start the comment, when the user starts a comment in the doc", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await startReply(user, "Half written");
    await elements.article().findByText("Retries happen three times.");

    selectText(elements.article().getByText("Retries happen three times."), "Retries".length);
    await user.click(await screen.findByRole("button", { name: "Comment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("You started another comment.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("textbox", { name: "Comment" })).toHaveFocus();
    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Half written");
  });

  test("must keep the comment's text, without asking, when the user starts a comment on the same text again", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await elements.article().findByText("Retries happen three times.");
    selectText(elements.article().getByText("Retries happen three times."), "Retries".length);
    await user.click(await screen.findByRole("button", { name: "Comment" }));
    await user.keyboard("Three is too many");

    selectText(elements.article().getByText("Retries happen three times."), "Retries".length);
    await user.click(await screen.findByRole("button", { name: "Comment" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("Three is too many");
    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveFocus();
  });
```

- [ ] **Step 7: Run them to verify they fail**

Run: `pnpm test --project web src/web/components/ThreadSidebar src/web/components/App`
Expected: FAIL. There is no alert, no Keep editing, and no "to save" hint. Escape and Cmd+Enter do nothing.

- [ ] **Step 8: Write the question, the buttons, the keys and the hint**

Create `src/web/components/CommentForm/UnsavedQuestion.tsx`:

```tsx
import { Alert } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { EditorQuestion, HeldRequest } from "../../review/useCommentEditor";

export interface UnsavedQuestionProps {
  /**
   * Whether the editor changes a saved draft, rather than writing a new comment or reply
   */
  isDraft: boolean;

  question: EditorQuestion;
}

/**
 * Asks the user what to do with text they have not saved, and says what is waiting on the answer
 */
export function UnsavedQuestion({ isDraft, question: { held } }: UnsavedQuestionProps): JSX.Element {
  return (
    <Alert role="alert" title={titleOf(isDraft, held !== null)} tone="warning">
      {held === null ? null : describeHeld(held)}
    </Alert>
  );
}

function titleOf(isDraft: boolean, isHolding: boolean): string {
  const text = isDraft ? "your changes" : "this comment";
  return isHolding ? `Save ${text} first?` : `Save ${text}?`;
}

function describeHeld(held: HeldRequest): string {
  switch (held.kind) {
    case "comment":
      return "You started another comment.";
    case "edit":
      return `You started editing #${held.threadId}.`;
    case "reply":
      return `You started a reply to #${held.threadId}.`;
  }
}
```

Create `src/web/components/CommentForm/CommentFormButtons.tsx`:

```tsx
import { Button } from "@krelborn/stylesui";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { useCommentEditorContext } from "../../review/useCommentEditorContext";

import styles from "./CommentForm.module.css";

export interface CommentFormButtonsProps {
  /**
   * Whether the editor is saving, which marks Save busy
   */
  isSaving: boolean;

  /**
   * Shown at the start of the row while the editor is not asking, away from Save
   */
  leading?: ReactNode;
}

/**
 * The editor's buttons: Cancel and Save, or, while it asks about unsaved text, Discard, Keep editing and Save
 */
export function CommentFormButtons({ isSaving, leading }: CommentFormButtonsProps): JSX.Element {
  const editor = useCommentEditorContext();
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const isAsking = editor.question !== null;
  useEffect(() => {
    if (isAsking) {
      const save = saveRef.current;
      (save !== null && !save.disabled ? save : keepEditingRef.current)?.focus();
    }
  }, [isAsking]);
  const start = isAsking ? (
    <Button onClick={editor.discardChanges} size="sm" variant="outline">
      {editor.savedBody === null ? "Discard" : "Discard changes"}
    </Button>
  ) : (
    leading
  );
  return (
    <div className={styles.buttons}>
      {start !== undefined && <div className={styles.leading}>{start}</div>}
      <Button onClick={isAsking ? editor.keepEditing : editor.close} ref={keepEditingRef} size="sm" variant="outline">
        {isAsking ? "Keep editing" : "Cancel"}
      </Button>
      <Button busy={isSaving} disabled={!editor.canSave} ref={saveRef} size="sm" type="submit">
        Save
      </Button>
    </div>
  );
}
```

Create `src/web/components/CommentForm/useEditorKeys.ts`:

```ts
import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Lets the user save the editor with Cmd+Enter or Ctrl+Enter, and answer Escape, from anywhere inside it
 *
 * @param formRef the editor's form
 * @param escape what Escape does
 */
export function useEditorKeys(formRef: RefObject<HTMLFormElement | null>, escape: () => void): void {
  useEffect(() => {
    const form = formRef.current;
    if (form === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        escape();
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    };
    form.addEventListener("keydown", onKeyDown);
    return () => form.removeEventListener("keydown", onKeyDown);
  }, [escape, formRef]);
}
```

The listener is attached in an effect rather than through `onKeyDown`, because oxlint's `jsx-a11y/no-noninteractive-element-interactions` rejects key handlers on a `form`.

Create `src/web/components/CommentForm/SaveShortcutHint.tsx`:

```tsx
import { Kbd, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

/**
 * Tells the user they can save with Cmd+Enter on a Mac, or Ctrl+Enter elsewhere
 */
export function SaveShortcutHint(): JSX.Element {
  const modifier = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
  return (
    <Text size="xs" tone="muted">
      <Kbd>{modifier}</Kbd> <Kbd>↩</Kbd> to save
    </Text>
  );
}
```

- [ ] **Step 9: Put them into `CommentForm` and the composer**

Replace `src/web/components/CommentForm/CommentForm.tsx` with:

```tsx
import { Alert, Stack, Textarea } from "@krelborn/stylesui";
import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { describeFailure } from "../../api/describeFailure";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";

import { CommentFormButtons } from "./CommentFormButtons";
import { UnsavedQuestion } from "./UnsavedQuestion";
import { useEditorKeys } from "./useEditorKeys";

export interface CommentFormProps {
  /**
   * Names the text box for screen readers
   */
  label: string;

  /**
   * Shown at the start of the row of buttons, away from Save, such as the button that discards a draft
   */
  leading?: ReactNode;
}

/**
 * The open comment editor: its text box and buttons, and, while it holds text the user might lose, what to do with it
 */
export function CommentForm({ label, leading }: CommentFormProps): JSX.Element {
  const editor = useCommentEditorContext();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { escape, focusRevision, question } = editor;
  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusRevision]);
  useEditorKeys(formRef, escape);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await editor.save();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Stack as="form" gap={2} onSubmit={(event: FormEvent) => void submit(event)} ref={formRef}>
      {question !== null && <UnsavedQuestion isDraft={editor.savedBody !== null} question={question} />}
      <Textarea
        onChange={(event) => editor.changeBody(event.target.value)}
        ref={textareaRef}
        rows={3}
        value={editor.body}
        aria-label={label}
      />
      {error !== null && (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      )}
      <CommentFormButtons isSaving={isSaving} leading={leading} />
    </Stack>
  );
}
```

In `src/web/components/ThreadSidebar/NewCommentForm.tsx`, add `import { SaveShortcutHint } from "../CommentForm/SaveShortcutHint";` after the `CommentForm` import, and change `<CommentForm label={labelOf(anchor)} />` to:

```tsx
        <CommentForm label={labelOf(anchor)} leading={<SaveShortcutHint />} />
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test --project web`
Expected: PASS.

- [ ] **Step 11: Check, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm format && pnpm exec fallow audit`
Expected: no lint or type errors; fallow's verdict is not `fail`.

```bash
git add -A src/web
git commit -m "Ask whether to save or discard unsaved text before opening another comment, and save with Cmd+Enter and close with Escape

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Offer This doc and All docs as tabs only when another doc has threads, in a header that stays in view

**Files:**
- Create: `src/web/review/threadsInView.ts`
- Test: `src/web/review/threadsInView.test.ts`
- Create: `src/web/components/ThreadSidebar/CommentsList.tsx`, `ThreadSidebar.module.css`
- Modify: `src/web/components/ThreadSidebar/ThreadSidebar.tsx`
- Modify: `src/web/components/CommentsHeader/CommentsHeader.tsx`, `CommentsHeader.module.css`
- Modify: `src/web/components/App/App.tsx`, `App.module.css`
- Test: `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`, `src/web/components/App/App.test.tsx`

**Interfaces:**
- Consumes: `CommentEditor.editingThreadId` and `newComment` (Task 1), `useCommentEditorContext` (Task 3).
- Produces:
  - `type ThreadView = "all" | "document"`.
  - `threadsInView(threads, documentPath, chosen, editingThreadId): ThreadsInView`, where `ThreadsInView` is `{ counts: Record<ThreadView, number>; hasChoice: boolean; showsDocuments: boolean; threads: Thread[]; view: ThreadView }`.
  - `ThreadSidebarProps` gains `closeButton: ReactNode`. `CommentsHeaderProps` gains `closeButton: ReactNode`.
  - The tabs are named like "This doc 5" and "All docs 6".

- [ ] **Step 1: Write the failing tests for what the panel lists**

Create `src/web/review/threadsInView.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread } from "../../shared/review/testing/reviewBuilders";

import { threadsInView } from "./threadsInView";

const planThread = buildThread({ anchor: buildPassageAnchor(), id: 1 });

const reviewThread = buildThread({ anchor: { kind: "review" }, id: 2 });

const specThread = buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), id: 3 });

describe("threadsInView", () => {
  test("must list this doc's and the review's threads, and offer no choice, when no other doc has threads", () => {
    const inView = threadsInView([planThread, reviewThread], "docs/plan.md", "document", null);

    expect(inView).toMatchObject({
      hasChoice: false,
      showsDocuments: false,
      threads: [planThread, reviewThread],
      view: "document",
    });
  });

  test("must offer a choice, and count each view's threads, when another doc has threads", () => {
    const inView = threadsInView([planThread, reviewThread, specThread], "docs/plan.md", "document", null);

    expect(inView).toMatchObject({
      counts: { all: 3, document: 2 },
      hasChoice: true,
      threads: [planThread, reviewThread],
    });
  });

  test("must list every thread under its doc when the user chooses All docs", () => {
    const inView = threadsInView([planThread, reviewThread, specThread], "docs/plan.md", "all", null);

    expect(inView).toMatchObject({
      showsDocuments: true,
      threads: [planThread, reviewThread, specThread],
      view: "all",
    });
  });

  test("must list This doc when the user chose All docs but no other doc has threads", () => {
    const inView = threadsInView([planThread, reviewThread], "docs/plan.md", "all", null);

    expect(inView).toMatchObject({ threads: [planThread, reviewThread], view: "document" });
  });

  test("must list the thread being written to, under its doc, when it is on another doc", () => {
    const inView = threadsInView([planThread, specThread], "docs/plan.md", "document", 3);

    expect(inView).toMatchObject({
      counts: { all: 2, document: 2 },
      showsDocuments: true,
      threads: [planThread, specThread],
    });
  });

  test("must list every thread under its doc, and offer no choice, when the docs list is on screen", () => {
    const inView = threadsInView([planThread, specThread], null, "document", null);

    expect(inView).toMatchObject({ hasChoice: false, showsDocuments: true, threads: [planThread, specThread] });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test --project web src/web/review/threadsInView.test.ts`
Expected: FAIL with `Failed to resolve import "./threadsInView"`.

- [ ] **Step 3: Write `threadsInView`**

Create `src/web/review/threadsInView.ts`:

```ts
import type { Thread } from "../../shared/review/threadSchema";

/**
 * Which threads the comments list: those on the doc on screen and the review, or those on every doc
 */
export type ThreadView = "all" | "document";

export interface ThreadsInView {
  /**
   * How many threads each view lists
   */
  counts: Record<ThreadView, number>;

  /**
   * Whether the user can choose a view, which they can only when a thread is on a doc other than the one on screen
   */
  hasChoice: boolean;

  /**
   * Whether to head each doc's threads with its path, because the list holds more than one doc's
   */
  showsDocuments: boolean;

  threads: Thread[];

  /**
   * The view listed, which is This doc whenever there is no choice
   */
  view: ThreadView;
}

/**
 * Works out which threads the comments list
 *
 * @param threads every thread in the repo
 * @param documentPath the doc on screen, or null on the docs list, which lists every thread
 * @param chosen the view the user chose
 * @param editingThreadId the thread whose reply or draft is being written, which This doc lists wherever it is
 * @returns the threads to list, in the order given, and what the header needs to offer a choice
 */
export function threadsInView(
  threads: readonly Thread[],
  documentPath: string | null,
  chosen: ThreadView,
  editingThreadId: number | null
): ThreadsInView {
  if (documentPath === null) {
    return {
      counts: { all: threads.length, document: threads.length },
      hasChoice: false,
      showsDocuments: true,
      threads: [...threads],
      view: "all",
    };
  }
  const isOnDocument = ({ anchor }: Thread): boolean => anchor.kind === "review" || anchor.document === documentPath;
  const thisDocument = threads.filter((thread) => isOnDocument(thread) || thread.id === editingThreadId);
  const hasChoice = threads.some((thread) => !isOnDocument(thread));
  const view = hasChoice ? chosen : "document";
  const listed = view === "all" ? [...threads] : thisDocument;
  return {
    counts: { all: threads.length, document: thisDocument.length },
    hasChoice,
    showsDocuments: listed.some((thread) => !isOnDocument(thread)),
    threads: listed,
    view,
  };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test --project web src/web/review/threadsInView.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing panel and App tests**

In `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`:

1. Replace `setUpTest` with:

```tsx
function setUpTest({
  documentPath = "docs/plan.md",
  threads: shown = threads,
}: { documentPath?: string | null; threads?: Thread[] } = {}) {
  localStorage.clear();
  const fake = createFakeReviewApi({ threads: shown });
  const onChanged = vi.fn();
  const onSelectThread = vi.fn();
  const view = (listed: Thread[]) => (
    <ReviewApiContext value={fake.api}>
      <CommentEditorHarness onChanged={onChanged} threads={listed}>
        {(editor) => (
          <ThreadSidebar
            closeButton={null}
            documentPath={documentPath}
            editor={editor}
            onChanged={onChanged}
            onSelectThread={onSelectThread}
            selectedThreadId={null}
            threads={listed}
          />
        )}
      </CommentEditorHarness>
    </ReviewApiContext>
  );
  let rerenderBase: (ui: ReturnType<typeof view>) => void = () => {};
  const render = (): void => {
    rerenderBase = renderBase(view(shown)).rerender;
  };
  const showThreads = (listed: Thread[]): void => {
    rerenderBase(view(listed));
  };
  return { fake, onChanged, onSelectThread, render, showThreads };
}
```

2. In `"must show every doc's threads under their doc when the user chooses All docs"`, replace `await user.click(screen.getByRole("radio", { name: "All docs" }));` with `await user.click(screen.getByRole("tab", { name: "All docs 6" }));`.
3. Add these tests after it:

```tsx
  test("must count each view's threads on its tab when another doc has threads", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["This doc 5", "All docs 6"]);
  });

  test("must show the title and count, and no tabs, when only this doc and the review have threads", () => {
    const { render } = setUpTest({ threads: threads.slice(0, 5) });

    render();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Comments")).toHaveTextContent("Comments 5");
  });

  test("must go back to This doc when the user chose All docs and the other doc's threads went", async () => {
    const { render, showThreads } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("tab", { name: "All docs 6" }));

    showThreads(threads.slice(0, 5));
    showThreads(threads);

    expect(screen.getByRole("tab", { name: "This doc 5" })).toHaveAttribute("aria-selected", "true");
  });
```

In `src/web/components/App/App.test.tsx`:

1. In `"must show the thread's doc when the user selects a thread on another doc"`, replace `await user.click(screen.getByRole("radio", { name: "All docs" }));` with `await user.click(screen.getByRole("tab", { name: "All docs 2" }));`.
2. Add these tests after `"must keep the user's unsent reply when the agent opens another doc and the user comes back"`:

```tsx
  test("must keep listing the thread the user is replying to, with the reply, when the agent opens another doc", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await startReply(user, "Half written");

    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });
    await screen.findByRole("heading", { level: 1, name: "docs/spec.md" });

    const thread = within(screen.getByRole("article", { name: "Thread #1" }));
    expect(thread.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  });

  test("must keep the comment the user is writing, under its doc's path, when the agent opens another doc", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await elements.article().findByText("Retries happen three times.");
    selectText(elements.article().getByText("Retries happen three times."), "Retries".length);
    await user.click(await screen.findByRole("button", { name: "Comment" }));
    await user.keyboard("Three is too many");

    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });
    await screen.findByRole("heading", { level: 1, name: "docs/spec.md" });

    const composer = within(screen.getByRole("region", { name: "New comment" }));
    expect(composer.getByText("docs/plan.md")).toBeInTheDocument();
    expect(composer.getByRole("textbox", { name: "Comment" })).toHaveValue("Three is too many");
  });
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm test --project web src/web/components/ThreadSidebar src/web/components/App`
Expected: FAIL. There are no tabs, and on `docs/spec.md` Thread #1 is not listed.

- [ ] **Step 7: Split the list out of the sidebar**

Create `src/web/components/ThreadSidebar/CommentsList.tsx`:

```tsx
import { Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { groupThreads } from "../../review/groupThreads";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";
import { useSeenMessages } from "../../review/useSeenMessages";

import { NewCommentForm } from "./NewCommentForm";
import { ThreadGroup } from "./ThreadGroup";

export interface CommentsListProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called after the list changes threads on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see a thread in its doc
   */
  onSelectThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Whether to head each doc's threads with its path
   */
  showsDocuments: boolean;

  /**
   * The threads to list
   */
  threads: Thread[];
}

/**
 * The comments under the header: the composer while the user starts a comment, then the threads in their groups
 */
export function CommentsList({
  documentPath,
  onChanged,
  onSelectThread,
  selectedThreadId,
  showsDocuments,
  threads,
}: CommentsListProps): JSX.Element {
  const editor = useCommentEditorContext();
  const seen = useSeenMessages();
  const groups = groupThreads(threads);
  const listProps = {
    hasNewAgentMessage: seen.hasNewAgentMessage,
    onChanged,
    onSelect: (thread: Thread) => {
      seen.markSeen(thread);
      onSelectThread(thread);
    },
    selectedThreadId,
    showsDocuments,
  };
  return (
    <Stack gap={4}>
      {editor.newComment !== null && (
        <NewCommentForm
          documentPath={documentPath}
          key={JSON.stringify(editor.newComment.anchor)}
          newComment={editor.newComment}
        />
      )}
      {threads.length === 0 && (
        <Text as="p" size="sm" tone="muted">
          No comments yet. Select text in the doc, or press + beside a block, to comment on it.
        </Text>
      )}
      <ThreadGroup isFolded={false} threads={groups.drafts} title="Drafts" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.open} title="Open" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.outdated} title="Outdated" {...listProps} />
      <ThreadGroup
        isFolded={!groups.resolved.some((thread) => thread.id === editor.editingThreadId)}
        threads={groups.resolved}
        title="Resolved"
        {...listProps}
      />
    </Stack>
  );
}
```

- [ ] **Step 8: Rewrite the sidebar around the tabs**

Replace `src/web/components/ThreadSidebar/ThreadSidebar.tsx` with:

```tsx
import { Counter, Tab, TabList, TabPanel, Tabs, Text } from "@krelborn/stylesui";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { CommentEditorContext } from "../../review/CommentEditorContext";
import type { ThreadView } from "../../review/threadsInView";
import { threadsInView } from "../../review/threadsInView";
import type { CommentEditor } from "../../review/useCommentEditor";
import { CommentsHeader } from "../CommentsHeader/CommentsHeader";

import { CommentsList } from "./CommentsList";
import styles from "./ThreadSidebar.module.css";

export interface ThreadSidebarProps {
  /**
   * The button that hides the comments in a narrow window, shown at the end of their header
   */
  closeButton: ReactNode;

  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * The page's comment editor, which the sidebar shows as the composer or inside the card of the thread it writes to
   */
  editor: CommentEditor;

  /**
   * Called after the sidebar changes threads on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see a thread in its doc
   */
  onSelectThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Every thread in the repo
   */
  threads: Thread[];
}

/**
 * The comments beside the doc: a header that starts comments on the doc or the review and, when other docs have
 * threads, chooses between this doc's threads and every doc's; then the composer and the threads
 */
export function ThreadSidebar({
  closeButton,
  documentPath,
  editor,
  onChanged,
  onSelectThread,
  selectedThreadId,
  threads,
}: ThreadSidebarProps): JSX.Element {
  const [chosenView, setChosenView] = useState<ThreadView>("document");
  const inView = threadsInView(threads, documentPath, chosenView, editor.editingThreadId);
  if (!inView.hasChoice && chosenView !== "document") {
    setChosenView("document");
  }
  const header = (title: ReactNode): JSX.Element => (
    <CommentsHeader
      closeButton={closeButton}
      documentPath={documentPath}
      onComment={(comment) => editor.request({ comment, kind: "new" })}
      title={title}
    />
  );
  const list = (
    <CommentsList
      documentPath={documentPath}
      onChanged={onChanged}
      onSelectThread={onSelectThread}
      selectedThreadId={selectedThreadId}
      showsDocuments={inView.showsDocuments}
      threads={inView.threads}
    />
  );
  return (
    <CommentEditorContext value={editor}>
      <aside aria-label="Comments">
        {inView.hasChoice ? (
          <Tabs
            className={styles.tabs}
            onValueChange={(value) => setChosenView(value === "all" ? "all" : "document")}
            size="sm"
            value={inView.view}
          >
            {header(
              <TabList aria-label="Show comments on">
                <Tab value="document">
                  This doc <Counter count={inView.counts.document} />
                </Tab>
                <Tab value="all">
                  All docs <Counter count={inView.counts.all} />
                </Tab>
              </TabList>
            )}
            <TabPanel value="document">{list}</TabPanel>
            <TabPanel value="all">{list}</TabPanel>
          </Tabs>
        ) : (
          <>
            {header(
              <Text weight="bold">
                Comments <Counter count={inView.threads.length} />
              </Text>
            )}
            {list}
          </>
        )}
      </aside>
    </CommentEditorContext>
  );
}
```

A `TabPanel` renders its children only while its tab is selected, so both panels can take the same list.

Create `src/web/components/ThreadSidebar/ThreadSidebar.module.css`:

```css
/* The header already spaces itself from the list */
.tabs {
  gap: 0;
}
```

- [ ] **Step 9: Make the header sticky, and give it the Hide comments button**

Replace `src/web/components/CommentsHeader/CommentsHeader.tsx` with:

```tsx
import type { JSX, ReactNode } from "react";

import type { NewComment } from "../../review/NewComment";
import { NewCommentMenu } from "../NewCommentMenu/NewCommentMenu";

import styles from "./CommentsHeader.module.css";

export interface CommentsHeaderProps {
  /**
   * The button that hides the comments, which shows only in a narrow window
   */
  closeButton: ReactNode;

  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called when the user starts a comment on the doc or on the whole review
   */
  onComment: (newComment: NewComment) => void;

  /**
   * The start of the header: the title and its count, or the tabs that choose which threads to list
   */
  title: ReactNode;
}

/**
 * The top of the comments, which stays in view as they scroll: their title or tabs, the button that starts a comment on
 * the doc or the review, and in a narrow window the button that hides them
 */
export function CommentsHeader({ closeButton, documentPath, onComment, title }: CommentsHeaderProps): JSX.Element {
  return (
    <div className={styles.header}>
      <div className={styles.title}>{title}</div>
      <div className={styles.actions}>
        <NewCommentMenu documentPath={documentPath} onComment={onComment} />
        <div className={styles.closeButton}>{closeButton}</div>
      </div>
    </div>
  );
}
```

Replace `src/web/components/CommentsHeader/CommentsHeader.module.css` with:

```css
/* The comments' scroller pads its content, so the header reaches over that padding with negative margins, and the
   negative top lets it stick at the scroller's edge */
.header {
  align-items: center;
  background-color: var(--sui-color-background);
  border-block-end: var(--sui-border-width) solid var(--sui-color-border);
  display: flex;
  gap: var(--sui-space-2);
  justify-content: space-between;
  margin: calc(-1 * var(--sui-space-4)) calc(-1 * var(--sui-space-4)) var(--sui-space-4);
  min-block-size: 3rem;
  padding: 0 var(--sui-space-4);
  position: sticky;
  top: calc(-1 * var(--sui-space-4));
  z-index: 1;
}

.title {
  align-items: center;
  align-self: stretch;
  display: flex;
  min-inline-size: 0;
}

/* The header's border takes the place of the tabs' own underline, which would sit inside it */
.title [role="tablist"] {
  align-self: stretch;
  border-block-end: none;
}

.actions {
  align-items: center;
  display: flex;
  gap: var(--sui-space-1);
}

/* 48rem is App.module.css's breakpoint, below which the comments become a drawer */
@media (width >= 48rem) {
  .closeButton {
    display: none;
  }
}
```

In `src/web/components/App/App.tsx`, delete the `<div className={styles.drawerHeader}>…</div>` element. Add its `IconButton` to `ThreadSidebar` as the first prop:

```tsx
            <ThreadSidebar
              closeButton={
                <IconButton label="Hide comments" onClick={closePanel} ref={closeButtonRef} size="sm" variant="ghost">
                  <CloseIcon />
                </IconButton>
              }
              documentPath={documentPath}
```

In `src/web/components/App/App.module.css`, delete:
- the wide `.drawerHeader { display: none; }` rule
- the narrow `.drawerHeader` rule, together with the comment above it that begins "Takes over the drawer's top and end padding"

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test --project web`
Expected: PASS.

Run: `pnpm test:e2e src/e2e/layout.e2e.ts`
Expected: PASS in Chromium and WebKit. These tests cover Hide comments, focus moving into the drawer and back, and the drawer staying open across the breakpoint.

- [ ] **Step 11: Look at it**

Follow "Visual checks" in Global Constraints. Check these in light and dark mode:
- with comments on `docs/plan.md` only, the header reads "Comments" with a count and **+ Comment**
- after commenting on `docs/spec.md` and going back to `docs/plan.md`, the header shows This doc and All docs tabs with counts
- the tab underline sits on the header's bottom border
- the header stays put while a long list of comments scrolls beneath it
- at 700px wide, the drawer's header shows the Hide comments button at its end

- [ ] **Step 12: Check, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm format && pnpm exec fallow audit`
Expected: no lint or type errors; fallow's verdict is not `fail`.

```bash
git add -A src/web
git commit -m "Offer This doc and All docs as tabs only when another doc has threads, keep the thread being written to in view, and hold the comments' header in place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Fit the review bar on one row, and show what Submit sends before the user picks a verdict

**Files:**
- Create: `src/web/review/countDraftsByDocument.ts`
- Test: `src/web/review/countDraftsByDocument.test.ts`
- Delete: `src/web/review/countDrafts.ts`
- Modify: `src/web/components/SubmitMenu/SubmitMenu.tsx`; Create: `DraftsSummary.tsx`, `VerdictOption.tsx`, `SubmitMenu.module.css`
- Modify: `src/web/components/ReviewBar/ReviewBar.tsx`, `ReviewBar.module.css`
- Modify: `src/web/components/App/App.tsx`
- Test: `src/web/components/ReviewBar/ReviewBar.test.tsx`, `src/web/components/App/App.test.tsx`, `src/e2e/testing/reviewTest.ts`, `src/e2e/layout.e2e.ts`, `src/e2e/review.e2e.ts`

**Interfaces:**
- Consumes: `CommentEditor.hasUnsavedText` (Task 1).
- Produces:
  - `interface DraftCount { count: number; document: string | null }` and `countDraftsByDocument(threads): DraftCount[]`. A null `document` counts the review's drafts.
  - `ReviewBarProps` and `SubmitMenuProps` replace `draftCount: number` with `drafts: DraftCount[]`, and gain `hasUnsavedText: boolean`.
  - The Submit trigger is named "Submit" with no drafts, "Submit 1 draft" with one, and "Submit N drafts" otherwise.
  - The end-to-end helper `submitButtonName(draftCount: number): string` is exported from `reviewTest.ts`.

- [ ] **Step 1: Write the failing test for counting drafts by doc**

Create `src/web/review/countDraftsByDocument.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../shared/review/testing/reviewBuilders";

import { countDraftsByDocument } from "./countDraftsByDocument";

const draft = { at: testTime, body: "Why?" };

describe("countDraftsByDocument", () => {
  test("must count the review's drafts first, then each doc's in path order, and leave out docs without drafts", () => {
    const counts = countDraftsByDocument([
      buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), draft, id: 1 }),
      buildThread({ anchor: buildPassageAnchor(), draft, id: 2, messages: [], status: "draft" }),
      buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, draft, id: 3 }),
      buildThread({ anchor: { kind: "review" }, draft, id: 4 }),
      buildThread({ anchor: buildPassageAnchor({ document: "docs/zebra.md" }), id: 5 }),
    ]);

    expect(counts).toEqual([
      { count: 1, document: null },
      { count: 2, document: "docs/plan.md" },
      { count: 1, document: "docs/spec.md" },
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test --project web src/web/review/countDraftsByDocument.test.ts`
Expected: FAIL with `Failed to resolve import "./countDraftsByDocument"`.

- [ ] **Step 3: Write `countDraftsByDocument`, and delete `countDrafts`**

Create `src/web/review/countDraftsByDocument.ts`:

```ts
import type { Thread } from "../../shared/review/threadSchema";

export interface DraftCount {
  count: number;

  /**
   * The doc's path, or null for drafts on the whole review
   */
  document: string | null;
}

/**
 * Counts the new comments and replies the user has not yet submitted on each doc
 *
 * @returns the review's drafts first, then each doc's in path order; docs without drafts are left out
 */
export function countDraftsByDocument(threads: readonly Thread[]): DraftCount[] {
  const counts = new Map<string | null, number>();
  for (const { anchor, draft } of threads) {
    if (draft !== undefined) {
      const document = anchor.kind === "review" ? null : anchor.document;
      counts.set(document, (counts.get(document) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([document, count]) => ({ count, document }))
    .sort((left, right) => (left.document ?? "").localeCompare(right.document ?? ""));
}
```

```bash
git rm src/web/review/countDrafts.ts
```

Run: `pnpm test --project web src/web/review/countDraftsByDocument.test.ts`
Expected: PASS.

- [ ] **Step 4: Rewrite the review bar tests**

Replace `src/web/components/ReviewBar/ReviewBar.test.tsx` with:

```tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import type { DraftCount } from "../../review/countDraftsByDocument";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ReviewBar } from "./ReviewBar";

const draftThread = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

const oneDraft: DraftCount[] = [{ count: 1, document: "docs/plan.md" }];

describe("ReviewBar", () => {
  test("must say the agent is listening when the agent has a poll open", () => {
    const { render } = setUpTest();

    render({ agentWaiting: true });

    expect(within(screen.getByRole("status")).getByText("Agent listening")).toBeInTheDocument();
  });

  test("must say the agent is not listening when the agent has no poll open", () => {
    const { render } = setUpTest();

    render();

    expect(within(screen.getByRole("status")).getByText("Agent not listening")).toBeInTheDocument();
  });

  test.each([
    { agentWaiting: true, explanation: "The agent is listening and will hear at once." },
    {
      agentWaiting: false,
      explanation: "The agent isn't listening. It will find this in its inbox when it next looks.",
    },
  ])(
    "must explain in the submit popover what the agent will do when its poll open state is $agentWaiting",
    async ({ agentWaiting, explanation }) => {
      const { render } = setUpTest();
      const user = userEvent.setup();
      render({ agentWaiting });

      await user.click(screen.getByRole("button", { name: "Submit" }));

      expect(elements.submitDialog().getByText(explanation)).toBeInTheDocument();
    }
  );

  test("must show the review as approved when the user approved this round", () => {
    const { render } = setUpTest();

    render({ review: { approved: true, approvedAt: testTime, requestedAt: testTime } });

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  test("must offer only approval when the user has no drafts", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(elements.submitDialog().getByText("You have no drafts.")).toBeInTheDocument();
    expect(elements.submitDialog().getByRole("radio", { name: "Request changes" })).toBeDisabled();
    expect(elements.submitDialog().getByRole("radio", { name: "Approve" })).toBeChecked();
  });

  test("must say how many drafts a submit sends, and which docs they are on", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({
      drafts: [
        { count: 1, document: null },
        { count: 2, document: "docs/plan.md" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Submit 3 drafts" }));

    expect(elements.submitDialog().getByText("Sends 3 drafts:")).toBeInTheDocument();
    expect(elements.submitDialog().getByText("Whole review 1")).toBeInTheDocument();
    expect(elements.submitDialog().getByText("plan.md 2")).toHaveAttribute("title", "docs/plan.md");
  });

  test("must send the drafts to the agent when the user requests changes", async () => {
    const { fake, onSubmitted, render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    expect(elements.submitDialog().getByRole("radio", { name: "Request changes" })).toBeChecked();
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(fake.snapshot.threads).toMatchObject([{ messages: [{ author: "user", body: "Why 24h?" }], status: "open" }]);
    expect(fake.snapshot.review.approved).toBe(false);
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test("must approve the review when the user chooses Approve", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    await user.click(elements.submitDialog().getByRole("radio", { name: "Approve" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(fake.snapshot.review.approved).toBe(true);
  });

  test("must show why when the server refuses the submit", async () => {
    const { fake, render } = setUpTest();
    fake.api.submit.mockRejectedValueOnce(new ReviewApiError(409, "invalid-state", "There are no drafts to submit"));
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(await elements.submitDialog().findByRole("alert")).toHaveTextContent("There are no drafts to submit");
  });

  test("must ask the user to save or discard their comment, and not submit, while they have unsaved text", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft, hasUnsavedText: true });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));

    expect(
      elements.submitDialog().getByText("Save or discard the comment you're writing before you submit.")
    ).toBeInTheDocument();
    expect(elements.submitDialog().getByRole("button", { name: "Submit" })).toBeDisabled();
  });

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
});

interface RenderOptions {
  agentWaiting?: boolean;
  drafts?: DraftCount[];
  hasUnsavedText?: boolean;
  isPanelOpen?: boolean;
  review?: ReviewState;
}

function setUpTest() {
  const fake = createFakeReviewApi({ threads: [draftThread] });
  const onSubmitted = vi.fn();
  const onTogglePanel = vi.fn();
  const render = ({
    agentWaiting = false,
    drafts = [],
    hasUnsavedText = false,
    isPanelOpen = false,
    review = fake.snapshot.review,
  }: RenderOptions = {}): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ReviewBar
          agentWaiting={agentWaiting}
          drafts={drafts}
          hasUnsavedText={hasUnsavedText}
          isPanelOpen={isPanelOpen}
          onSubmitted={onSubmitted}
          onTogglePanel={onTogglePanel}
          panelId="comments-panel"
          panelToggleRef={createRef()}
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

In `src/web/components/App/App.test.tsx`:
- change `screen.findByRole("button", { name: "Submit (2)" })` to `screen.findByRole("button", { name: "Submit 2 drafts" })`
- change `screen.findByRole("button", { name: "Submit (1)" })` to `screen.findByRole("button", { name: "Submit 1 draft" })`

- [ ] **Step 5: Update the end-to-end helpers and tests**

In `src/e2e/testing/reviewTest.ts`, replace `submitDrafts` with these two functions:

```ts
/**
 * @returns the name of the review bar's Submit button when the user has the given number of drafts
 */
export function submitButtonName(draftCount: number): string {
  if (draftCount === 0) {
    return "Submit";
  }
  return `Submit ${draftCount} ${draftCount === 1 ? "draft" : "drafts"}`;
}

/**
 * Submits the user's drafts from the review bar
 *
 * @param draftCount how many drafts the submit button counts
 * @param verdict the verdict to choose in the popover
 */
export async function submitDrafts(
  page: Page,
  draftCount: number,
  verdict: "Approve" | "Request changes"
): Promise<void> {
  await page.getByRole("button", { exact: true, name: submitButtonName(draftCount) }).click();
  const popover = page.getByRole("dialog", { name: "Submit review" });
  await popover.getByRole("radio", { name: verdict }).check();
  await popover.getByRole("button", { exact: true, name: "Submit" }).click();
}
```

In `src/e2e/layout.e2e.ts`:
1. Add `submitButtonName` to the import from `./testing/reviewTest`, keeping the names in alphabetical order.
2. Replace every `page.getByRole("button", { name: "Submit (0)" })` with `page.getByRole("button", { exact: true, name: submitButtonName(0) })`.
3. Replace every `page.getByRole("button", { name: "Submit (1)" })` with `page.getByRole("button", { exact: true, name: submitButtonName(1) })`.
4. Replace ``page.getByRole("button", { exact: true, name: `Submit (${count})` })`` with `page.getByRole("button", { exact: true, name: submitButtonName(count) })`.
5. Replace `page.getByRole("button", { exact: true, name: "Submit (12)" })` with `page.getByRole("button", { exact: true, name: submitButtonName(12) })`.

`src/e2e/review.e2e.ts` uses only `submitDrafts`, so it needs no change.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm test --project web src/web/components/ReviewBar src/web/components/App`
Expected: FAIL. TypeScript reports that `ReviewBar` takes no `drafts` or `hasUnsavedText`. At run time there is no "Submit" button without a count, and no radios.

- [ ] **Step 7: Write the popover's parts**

Create `src/web/components/SubmitMenu/DraftsSummary.tsx`:

```tsx
import { Badge, Cluster, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DraftCount } from "../../review/countDraftsByDocument";

export interface DraftsSummaryProps {
  /**
   * The user's drafts on each doc, the review's first
   */
  drafts: DraftCount[];
}

/**
 * Says how many drafts a submit sends, and which docs they are on
 */
export function DraftsSummary({ drafts }: DraftsSummaryProps): JSX.Element {
  const total = drafts.reduce((sum, { count }) => sum + count, 0);
  if (total === 0) {
    return (
      <Text as="p" size="sm">
        You have no drafts.
      </Text>
    );
  }
  return (
    <Cluster gap={1}>
      <Text size="sm">Sends {total === 1 ? "1 draft" : `${total} drafts`}:</Text>
      {drafts.map(({ count, document }) => (
        <Badge key={document ?? ""} title={document ?? undefined}>
          {document === null ? "Whole review" : document.slice(document.lastIndexOf("/") + 1)} {count}
        </Badge>
      ))}
    </Cluster>
  );
}
```

Create `src/web/components/SubmitMenu/VerdictOption.tsx`:

```tsx
import { Radio, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useId } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";

import styles from "./SubmitMenu.module.css";

export interface VerdictOptionProps {
  /**
   * What submitting with this verdict will do
   */
  description: string;

  isDisabled: boolean;
  label: string;
  value: Verdict;
}

/**
 * One verdict the user can submit with: its radio, and what it will do
 */
export function VerdictOption({ description, isDisabled, label, value }: VerdictOptionProps): JSX.Element {
  const descriptionId = useId();
  return (
    <div className={styles.option}>
      <Radio disabled={isDisabled} value={value} aria-describedby={descriptionId}>
        {label}
      </Radio>
      <Text className={styles.description} id={descriptionId} size="sm" tone="muted">
        {description}
      </Text>
    </div>
  );
}
```

Create `src/web/components/SubmitMenu/SubmitMenu.module.css`:

```css
.option {
  display: flex;
  flex-direction: column;
  gap: var(--sui-space-1);
}

/* Lines the description up with the radio's label rather than its button */
.description {
  padding-inline-start: 1.75rem;
}
```

- [ ] **Step 8: Rewrite the Submit popover**

Replace `src/web/components/SubmitMenu/SubmitMenu.tsx` with:

```tsx
import {
  Alert,
  Button,
  Cluster,
  Counter,
  Popover,
  RadioGroup,
  Stack,
  Text,
  usePopover,
  VisuallyHidden,
} from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import type { DraftCount } from "../../review/countDraftsByDocument";

import { DraftsSummary } from "./DraftsSummary";
import { VerdictOption } from "./VerdictOption";

export interface SubmitMenuProps {
  /**
   * Whether the agent has a poll open, waiting for the user to submit
   */
  agentWaiting: boolean;

  /**
   * The user's drafts on each doc: new comments and replies
   */
  drafts: DraftCount[];

  /**
   * Whether the comment editor holds text the user has not saved, which they must save or discard before submitting
   */
  hasUnsavedText: boolean;

  /**
   * Called after the drafts are submitted
   */
  onSubmitted: () => void;
}

/**
 * Sends every draft to the agent with the verdict the user chooses: asking for changes, or approving the review
 */
export function SubmitMenu({ agentWaiting, drafts, hasUnsavedText, onSubmitted }: SubmitMenuProps): JSX.Element {
  const api = useReviewApi();
  const draftCount = drafts.reduce((sum, { count }) => sum + count, 0);
  const [verdict, setVerdict] = useState<Verdict>("approve");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const popover = usePopover({
    onOpenChange: (open) => {
      if (open) {
        setVerdict(draftCount > 0 ? "request-changes" : "approve");
        setError(null);
      }
    },
    placement: "top",
  });
  const submit = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      await api.submit(verdict);
      popover.close();
      onSubmitted();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      <Button {...popover.getTriggerProps()} variant={draftCount > 0 ? "primary" : "secondary"}>
        Submit <Counter count={draftCount} hiddenSuffix={draftCount === 1 ? "draft" : "drafts"} />
      </Button>
      <Popover {...popover.getOverlayProps()} aria-label="Submit review" role="dialog">
        <Stack gap={3}>
          <Text weight="bold">Submit review</Text>
          <DraftsSummary drafts={drafts} />
          <RadioGroup
            label={<VisuallyHidden>Verdict</VisuallyHidden>}
            onValueChange={(value) => setVerdict(value === "approve" ? "approve" : "request-changes")}
            value={verdict}
          >
            <VerdictOption
              description="Send your comments and ask the agent to revise."
              isDisabled={draftCount === 0}
              label="Request changes"
              value="request-changes"
            />
            <VerdictOption
              description={draftCount === 0 ? "End the review." : "Send your comments and end the review."}
              isDisabled={false}
              label="Approve"
              value="approve"
            />
          </RadioGroup>
          <Text as="p" size="sm" tone="muted">
            {agentWaiting
              ? "The agent is listening and will hear at once."
              : "The agent isn't listening. It will find this in its inbox when it next looks."}
          </Text>
          {hasUnsavedText && (
            <Alert tone="warning">Save or discard the comment you're writing before you submit.</Alert>
          )}
          {error !== null && (
            <Alert role="alert" tone="danger">
              {error}
            </Alert>
          )}
          <Cluster gap={2} justify="end">
            <Button onClick={popover.close} size="sm" variant="outline">
              Cancel
            </Button>
            <Button busy={isSubmitting} disabled={hasUnsavedText} onClick={() => void submit()} size="sm">
              Submit
            </Button>
          </Cluster>
        </Stack>
      </Popover>
    </>
  );
}
```

If fallow reports `SubmitMenu` above cognitive 15, move the `RadioGroup` and its two options into a `VerdictChoice` component in the same folder, which takes `draftCount`, `onChange` and `verdict`.

- [ ] **Step 9: Put the review bar on one row**

Replace `src/web/components/ReviewBar/ReviewBar.tsx` with:

```tsx
import { Badge, Button } from "@krelborn/stylesui";
import type { JSX, RefObject } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import type { DraftCount } from "../../review/countDraftsByDocument";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./ReviewBar.module.css";

export interface ReviewBarProps {
  agentWaiting: boolean;

  /**
   * The user's drafts on each doc
   */
  drafts: DraftCount[];

  /**
   * Whether the comment editor holds text the user has not saved
   */
  hasUnsavedText: boolean;

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

  /**
   * The Comments button, which takes focus when the panel closes with focus inside it
   */
  panelToggleRef: RefObject<HTMLButtonElement | null>;

  review: ReviewState;
}

/**
 * The bar beneath the comments, on one row: in a narrow window, a button that shows and hides them; then whether the
 * agent is listening, whether the review is approved, and Submit
 */
export function ReviewBar({
  agentWaiting,
  drafts,
  hasUnsavedText,
  isPanelOpen,
  onSubmitted,
  onTogglePanel,
  panelId,
  panelToggleRef,
  review,
}: ReviewBarProps): JSX.Element {
  return (
    <section className={styles.reviewBar} aria-label="Review">
      <Button
        className={styles.panelToggle}
        onClick={onTogglePanel}
        ref={panelToggleRef}
        variant="secondary"
        aria-controls={panelId}
        aria-expanded={isPanelOpen}
      >
        Comments
      </Button>
      <div className={styles.status}>
        <AgentStatus agentWaiting={agentWaiting} />
        {review.approved && (
          <Badge tone="success" variant="solid">
            Approved
          </Badge>
        )}
      </div>
      <SubmitMenu
        agentWaiting={agentWaiting}
        drafts={drafts}
        hasUnsavedText={hasUnsavedText}
        onSubmitted={onSubmitted}
      />
    </section>
  );
}
```

Replace `src/web/components/ReviewBar/ReviewBar.module.css` with:

```css
.reviewBar {
  align-items: center;
  display: flex;
  gap: var(--sui-space-3);
  padding: var(--sui-space-3) var(--sui-space-4);
}

.reviewBar > button {
  flex-shrink: 0;
  white-space: nowrap;
}

.status {
  align-items: center;
  display: flex;
  flex-grow: 1;
  gap: var(--sui-space-3);
  min-inline-size: 0;
}

/* 48rem is App.module.css's breakpoint, below which the comments panel becomes a drawer */
@media (width >= 48rem) {
  /* Two classes, to outrank the display that StylesUI's Button sets */
  .reviewBar .panelToggle {
    display: none;
  }
}
```

In `src/web/components/App/App.tsx`:
1. Replace `import { countDrafts } from "../../review/countDrafts";` with `import { countDraftsByDocument } from "../../review/countDraftsByDocument";`.
2. In the `ReviewBar` element, replace `draftCount={countDrafts(allThreads)}` with `drafts={countDraftsByDocument(allThreads)}`, and add `hasUnsavedText={editor.hasUnsavedText}` after it.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test --project web`
Expected: PASS.

Run: `pnpm test:e2e`
Expected: PASS in Chromium and WebKit.

- [ ] **Step 11: Look at it**

Follow "Visual checks" in Global Constraints. Check these in light and dark mode:
- in the wide layout, the review bar is one row: the status on the left, Submit on the right
- Submit is secondary with no drafts, and primary with a count pill once there is one
- the popover opens above Submit, with the draft chips, two radios with muted descriptions, the agent sentence, and Cancel and Submit on the right

- [ ] **Step 12: Check, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm format && pnpm exec fallow audit`
Expected: no lint or type errors; fallow's verdict is not `fail`.

```bash
git add -A src/web src/e2e
git commit -m "Fit the review bar on one row, and have Submit list the drafts it sends by doc before the user picks a verdict

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Keep the passage highlighted while the user writes, centre the doc, and tidy the top bar

**Files:**
- Create: `src/web/review/pendingPassageOn.ts`
- Test: `src/web/review/pendingPassageOn.test.ts`
- Modify: `src/web/components/DocumentView/useThreadHighlights.ts`, `DocumentView.tsx`, `DocumentView.module.css`
- Modify: `src/web/components/App/DocumentPane.tsx`, `App.tsx`
- Modify: `src/web/global.css`
- Modify: `src/web/components/TopBar/TopBar.tsx`, `TopBar.module.css`, `src/web/components/DocumentsMenu/DocumentsMenu.tsx`
- Test: `src/web/components/DocumentView/DocumentView.test.tsx`

**Interfaces:**
- Consumes: `CommentEditor.newComment` (Task 1), `ChevronDownIcon` (Task 3).
- Produces:
  - `pendingPassageOn(newComment: NewComment | null, documentPath: string): NewPassageAnchor | null`
  - `pendingHighlightName = "markdown-review-pending"`, exported from `useThreadHighlights.ts`
  - `useThreadHighlights` gains a last parameter, `pendingPassage: NewPassageAnchor | null`
  - `DocumentViewProps` gains `pendingPassage: NewPassageAnchor | null`, and `DocumentPaneProps` gains `pendingComment: NewComment | null`

- [ ] **Step 1: Write the failing tests**

Create `src/web/review/pendingPassageOn.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import type { NewComment } from "./NewComment";
import { pendingPassageOn } from "./pendingPassageOn";

const passage: NewPassageAnchor = {
  document: "docs/plan.md",
  endOffset: 29,
  kind: "passage",
  prefix: "",
  quote: "cache results for 24h",
  startOffset: 8,
  suffix: "",
};

describe("pendingPassageOn", () => {
  test("must find the passage when the comment being written is on a passage of the doc", () => {
    expect(pendingPassageOn({ anchor: passage }, "docs/plan.md")).toBe(passage);
  });

  test.each<{ condition: string; newComment: NewComment | null }>([
    { condition: "no comment is being written", newComment: null },
    { condition: "the comment is on the whole review", newComment: { anchor: { kind: "review" } } },
    {
      condition: "the comment is on the whole doc",
      newComment: { anchor: { document: "docs/plan.md", kind: "document" } },
    },
    {
      condition: "the comment's passage is on another doc",
      newComment: { anchor: { ...passage, document: "docs/spec.md" } },
    },
  ])("must find no passage when $condition", ({ newComment }) => {
    expect(pendingPassageOn(newComment, "docs/plan.md")).toBeNull();
  });
});
```

In `src/web/components/DocumentView/DocumentView.test.tsx`:
1. Add `import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";` after the `DocumentSource` import.
2. Change the `useThreadHighlights` import to `import { pendingHighlightName, selectedHighlightName, threadsHighlightName } from "./useThreadHighlights";`.
3. Add `pendingPassage?: NewPassageAnchor | null;` to `SetUpOptions`, in alphabetical order. Add `pendingPassage = null` to `setUpTest`'s destructured options, and `pendingPassage={pendingPassage}` to the `DocumentView` element in `view`, after `onSelectThread`.
4. Add this test after `"must highlight open and draft passages, and the selected thread's apart, but not resolved or outdated ones"`:

```tsx
  test("must highlight the passage of the comment the user is writing", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: "",
      },
    });

    await render();

    expect(elements.highlighted(pendingHighlightName)).toEqual(["cache results for 24h"]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test --project web src/web/review/pendingPassageOn.test.ts src/web/components/DocumentView`
Expected: FAIL with `Failed to resolve import "./pendingPassageOn"`. TypeScript reports that `useThreadHighlights` exports no `pendingHighlightName`.

- [ ] **Step 3: Write `pendingPassageOn`**

Create `src/web/review/pendingPassageOn.ts`:

```ts
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import type { NewComment } from "./NewComment";

/**
 * Finds the passage of the comment the user is writing, when it is on the given doc
 *
 * @param newComment the comment being written, or null
 * @param documentPath the doc on screen
 * @returns the comment's passage, or null when the comment is on the whole doc, the review or another doc
 */
export function pendingPassageOn(newComment: NewComment | null, documentPath: string): NewPassageAnchor | null {
  const anchor = newComment?.anchor;
  return anchor?.kind === "passage" && anchor.document === documentPath ? anchor : null;
}
```

- [ ] **Step 4: Highlight the pending passage**

In `src/web/components/DocumentView/useThreadHighlights.ts`:

1. Add `import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";` before the `Thread` type import.
2. After `export const selectedHighlightName = "markdown-review-selected";`, add:

```ts

export const pendingHighlightName = "markdown-review-pending";
```

3. Replace the hook's doc comment and signature with:

```ts
/**
 * Highlights the threads' passages in the rendered doc, the selected thread's apart from the rest and the passage of
 * the comment the user is writing apart again, and measures where each thread's passage starts so the view can mark it
 *
 * @param threads the threads to highlight; a new array on every render would measure the page on every render
 * @param pendingPassage the passage of the comment the user is writing on this doc, or null
 * @returns a marker for each thread's passage found in the page, top to bottom
 */
export function useThreadHighlights(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  threads: readonly Thread[],
  selectedThreadId: number | null,
  pendingPassage: NewPassageAnchor | null
): ThreadMarker[] {
```

4. In the layout effect, directly after the `CSS.highlights.set(selectedHighlightName, …)` call, add:

```ts
    const pendingRange =
      pendingPassage === null
        ? null
        : rangeForPassage(content, rendered.documentText, pendingPassage.startOffset, pendingPassage.endOffset);
    CSS.highlights.set(pendingHighlightName, new Highlight(...(pendingRange === null ? [] : [pendingRange])));
```

5. Add `CSS.highlights.delete(pendingHighlightName);` to the effect's cleanup, after the other two deletes.
6. Change the layout effect's dependency array to `[contentRef, layoutRevision, pendingPassage, rendered, selectedThreadId, threads, viewRef]`.

In `src/web/components/DocumentView/DocumentView.tsx`:

1. Add `import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";` after the `DocumentSource` import.
2. Add this prop to `DocumentViewProps` after `onSelectThread`:

```tsx
  /**
   * The passage of the comment the user is writing on this doc, or null
   */
  pendingPassage: NewPassageAnchor | null;
```

3. Add `pendingPassage` to the destructured props, after `onSelectThread`, and pass it to `useThreadHighlights` as the last argument:

```tsx
  const markers = useThreadHighlights(
    viewRef,
    contentRef,
    rendered,
    highlightedThreads,
    selectedThreadId,
    pendingPassage
  );
```

In `src/web/components/DocumentView/DocumentView.module.css`:
- replace the `.view` rule with the rule below
- after the `::highlight(markdown-review-selected)` rule, add the `::highlight(markdown-review-pending)` rule below

```css
/* The prose keeps a reading width, and the + and the markers sit in the padding either side of it */
.view {
  margin-inline: auto;
  max-inline-size: calc(72ch + 5rem);
  padding-inline: 2.5rem;
  position: relative;
}
```

```css
.content ::highlight(markdown-review-pending) {
  background-color: var(--sui-color-primary-subtle);
}
```

- [ ] **Step 5: Pass the comment being written from `App` to the doc**

In `src/web/components/App/DocumentPane.tsx`:

1. `DocumentPane` already imports the `NewComment` type. Add `import { pendingPassageOn } from "../../review/pendingPassageOn";` directly after that import.
2. Add this prop to `DocumentPaneProps` after `onSelectThread`:

```tsx
  /**
   * The comment the user is writing, or null
   */
  pendingComment: NewComment | null;
```

3. Change the component's signature to `export function DocumentPane({ documentPath, pendingComment, state, ...viewProps }: DocumentPaneProps): JSX.Element {`. Change its `"loaded"` case to:

```tsx
    case "loaded":
      return (
        <DocumentView
          document={state.document}
          pendingPassage={pendingPassageOn(pendingComment, documentPath)}
          {...viewProps}
        />
      );
```

In `src/web/components/App/App.tsx`, add `pendingComment={editor.newComment}` to the `DocumentPane` element, after `onSelectThread`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test --project web`
Expected: PASS.

- [ ] **Step 7: Give code blocks a surface, mute the path's folders, and make Docs a button**

Append to `src/web/global.css`:

```css

/* github-light paints code blocks the page's white, so in light mode they take the surface colour instead */
.shiki {
  border: var(--sui-border-width) solid var(--sui-color-border);
}

@media (prefers-color-scheme: light) {
  .shiki {
    background-color: var(--sui-color-surface) !important;
  }
}
```

In `src/web/components/TopBar/TopBar.tsx`, replace the `Heading` element with:

```tsx
      <Heading className={styles.path} level={1} size="md" title={documentPath ?? undefined}>
        <span className={styles.pathText}>{documentPath === null ? "Docs" : <PathText path={documentPath} />}</span>
      </Heading>
```

Add this function at the end of the file:

```tsx
function PathText({ path }: { path: string }): JSX.Element {
  const fileStart = path.lastIndexOf("/") + 1;
  return (
    <>
      <span className={styles.folders}>{path.slice(0, fileStart)}</span>
      {path.slice(fileStart)}
    </>
  );
}
```

Append to `src/web/components/TopBar/TopBar.module.css`:

```css

.folders {
  color: var(--sui-color-text-muted);
}
```

In `src/web/components/DocumentsMenu/DocumentsMenu.tsx`:
1. Add `import { ChevronDownIcon } from "../ChevronDownIcon/ChevronDownIcon";` before the `DocumentLinks` import.
2. Replace the trigger with:

```tsx
      <Button {...popover.getTriggerProps()} size="sm" variant="secondary">
        Docs <ChevronDownIcon />
      </Button>
```

Run: `pnpm test --project web src/web/components/TopBar`
Expected: PASS. The heading is still named "docs/plan.md", and the menu button is still named "Docs".

Run: `pnpm test:e2e`
Expected: PASS in Chromium and WebKit, including the tests that keep Comment in view at the column's right edge.

- [ ] **Step 8: Look at it**

Follow "Visual checks" in Global Constraints, with the window 1440px wide. Check these in light and dark mode:
- the prose is centred at reading width
- a thread's marker sits just right of the prose, not at the column's far edge
- the + still appears just left of a hovered block
- selecting text and pressing Comment keeps the passage highlighted in blue while you type
- code blocks have a border, and in light mode a grey surface
- the path's folders are muted, and Docs is a small grey button with a chevron

- [ ] **Step 9: Check, then commit**

Run: `pnpm lint && pnpm typecheck && pnpm format && pnpm exec fallow audit`
Expected: no lint or type errors; fallow's verdict is not `fail`, with `DocumentView` still at or under cognitive 15.

```bash
git add -A src/web
git commit -m "Keep the passage highlighted while the user writes a comment on it, centre the doc at reading width, and tidy code blocks and the top bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Test the new comment flow end to end, and describe it in the README and the design spec

**Files:**
- Create: `src/e2e/comments.e2e.ts`
- Modify: `src/e2e/testing/reviewTest.ts`
- Modify: `README.md`, `docs/superpowers/specs/2026-10-08-markdown-review-design.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `highlightedText(page, highlightName = "markdown-review-threads")` in `reviewTest.ts`.

- [ ] **Step 1: Let `highlightedText` read any highlight**

In `src/e2e/testing/reviewTest.ts`, replace `highlightedText` with:

```ts
/**
 * @returns the text of each passage the page highlights under the given name; by default, the threads' highlight
 */
export function highlightedText(page: Page, highlightName = "markdown-review-threads"): Promise<string[]> {
  return page.evaluate(
    (name) => [...(CSS.highlights.get(name) ?? [])].map((range) => range.toString()),
    highlightName
  );
}
```

- [ ] **Step 2: Write the end-to-end tests**

Create `src/e2e/comments.e2e.ts`:

```ts
import { expect } from "@playwright/test";

import { highlightedText, selectText, submitDrafts, test, writeDraftComment } from "./testing/reviewTest";

test("must ask about the first comment's text, then save it and start the next, when the user starts another comment", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await selectText(page, "cache", "24h");
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await page.keyboard.type("Why 24h?");

  await selectText(page, "Retries", "times.");
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await expect(page.getByRole("alert")).toContainText("Save this comment first?");
  await page.getByRole("button", { exact: true, name: "Save" }).click();

  await expect(page.getByRole("region", { name: "Drafts" }).getByRole("article")).toHaveCount(1);
  const composer = page.getByRole("region", { name: "New comment" });
  await expect(composer.getByText("Retries happen three times.")).toBeVisible();
  await expect(composer.getByRole("textbox", { name: "Comment" })).toBeFocused();
});

test("must keep the passage highlighted while the user writes a comment on it", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await selectText(page, "cache", "24h");

  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await page.keyboard.type("Why 24h?");

  await expect.poll(() => highlightedText(page, "markdown-review-pending")).toEqual(["cache results for 24h"]);
});

test("must keep a half-written reply when the user goes to another doc and back", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await submitDrafts(page, 1, "Request changes");
  await page.getByRole("article", { name: "Thread #1" }).getByRole("button", { name: "Reply" }).click();
  await page.keyboard.type("Half written");

  await page.getByRole("link", { name: "spec" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "docs/spec.md" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  await page.goBack();

  await expect(page.getByRole("heading", { level: 1, name: "docs/plan.md" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
});
```

- [ ] **Step 3: Run them**

Run: `pnpm test:e2e src/e2e/comments.e2e.ts`
Expected: PASS in Chromium and WebKit. These tests exercise behaviour Tasks 3 to 7 already built, so they pass on the first run. If one fails, the failure is in that behaviour, not in the test: fix the code in the task that owns it.

- [ ] **Step 4: Update the README**

In `README.md`, under "Review in the browser", replace everything from `- **Comment on a passage:**` down to the paragraph that begins `The sidebar groups threads` (keep the paragraph that begins `The bar beneath the comments`) with:

```markdown
- **Comment on a passage:** select text, including across paragraphs, and click **Comment**.
- **Comment on a block:** hover over a block and click the **+** in the left margin. Use this for code blocks, tables, diagrams and HTML.
- **Comment on a doc or on the whole review:** click **+ Comment** at the top of the comments and choose **On this doc** or **On the whole review**.

You write one comment at a time. If you start another while the open one has text you haven't saved, it asks whether to save or discard that text first. Press Cmd+Enter (Ctrl+Enter on Windows and Linux) to save, and Escape to close.

Saved comments are drafts, marked with a Draft badge, until you submit them. Click **Edit** to change one. When you are ready, click **Submit** at the foot of the comments. It shows how many drafts it will send and which docs they are on. Choose:

- **Request changes**, to send your drafts to the agent and wait for its answers.
- **Approve**, to end the review. Any drafts are sent with the approval, and the agent addresses them before carrying on.

The comments are grouped into Drafts, Open, Outdated and Resolved. When other docs have comments too, **This doc** and **All docs** tabs at the top switch between this doc's comments and every doc's, so you can review a set of docs together. Click a thread's location to jump to its passage, or click highlighted text to find its thread. Reply to a resolved thread to reopen it. A thread becomes outdated when the agent's edits remove the text it was on.
```

- [ ] **Step 5: Update section 10 of the design spec**

In `docs/superpowers/specs/2026-10-08-markdown-review-design.md`:

1. Under "### Review bar", replace the paragraph and list with:

```markdown
The review bar sits at the foot of the sidebar, on one row, and stays in view whatever the user has scrolled. It holds:

- Agent status: "Agent listening" while a poll is open, otherwise "Agent not listening". The **Submit** popover explains what that means: the agent will hear at once, or will find the submit in its inbox when it next looks.
- An "Approved" badge while the review is approved.
- **Submit**, with a count of the draft threads and draft replies across the whole repo when there are any. It is the primary button only while there are drafts. It opens a popover above it that:
  - says how many drafts it sends and which docs they are on
  - offers **Request changes** (disabled when there are no drafts) and **Approve** (always available; submits any drafts too) as radios
  - submits with its own **Submit** button, which stays disabled while the comment editor holds unsaved text
```

2. Under "### Narrow windows", replace `The drawer also has a **Hide comments** button at its top.` with `The sidebar's header also holds a **Hide comments** button.`.
3. Under "### Writing comments", replace the **Doc** and **Review** bullets with:

```markdown
- **Doc** and **review:** the **+ Comment** menu at the top of the sidebar offers **On this doc** and **On the whole review**. On the docs list, where only the review can take a comment, it is a **+ Review comment** button.
- **The composer** opens at the top of the sidebar with focus in it. While it is open, its passage stays highlighted in the doc.
- **One editor at a time.** A new comment, a reply and a draft being edited all use the same editor, with Cancel and Save on the right.
  - Starting another while the open editor holds unsaved text asks whether to save or discard that text first. An empty or unchanged editor just closes.
  - Cmd+Enter saves. Escape closes the editor, or asks first when it holds unsaved text.
  - Leaving the page with unsaved text triggers the browser's warning.
```

4. Under "### Sidebar":
   - Replace the `**This doc / All docs** toggle` bullet with: `- **This doc / All docs** tabs in the sidebar's header, each with a count, shown only when a doc other than the one on screen has threads. All docs lists every thread grouped by doc; this is how the user reviews the set as a whole. This doc also lists the thread whose reply or draft is being edited, wherever it is.`
   - Replace `Each thread shows its messages, a reply box (creates a draft reply), and a Resolve action.` with `Each thread shows its messages, each with an avatar, who wrote it and when. The user's draft shows as text with a Draft badge until they press **Edit**. **Reply** opens the editor for a draft reply, and **Resolve** resolves an open thread.`
   - Replace `show a "new" marker` with `show a **New reply** badge`.

- [ ] **Step 6: Run everything**

Run: `pnpm verify`
Expected: lint, format check, typecheck and every test pass.

Run: `pnpm test:e2e`
Expected: PASS in Chromium and WebKit.

- [ ] **Step 7: Commit**

```bash
git add src/e2e README.md docs/superpowers/specs/2026-10-08-markdown-review-design.md
git commit -m "Test the one-editor flow, the pending highlight and a reply kept across navigation end to end, and describe the new comments panel in the README and design spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
