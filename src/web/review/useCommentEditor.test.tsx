import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../shared/review/threadSchema";
import { ReviewApiContext } from "../api/ReviewApiContext";
import { ReviewApiError } from "../api/ReviewApiError";
import { createFakeReviewApi } from "../testing/createFakeReviewApi";

import type { EditorTarget } from "./EditorTarget";
import type { CommentEditor, HeldRequest } from "./useCommentEditor";
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

    expect(result.current).toMatchObject({ body: "Hourly", editingThreadId: 2, isSaving: false, question: null });
  });

  test.each<{ action: string; change: (editor: CommentEditor) => void }>([
    { action: "type", change: (editor) => editor.changeBody("Hourly, then") },
    { action: "cancel", change: (editor) => editor.close() },
    { action: "press Escape", change: (editor) => editor.escape() },
    { action: "keep editing", change: (editor) => editor.keepEditing() },
    { action: "discard the text", change: (editor) => editor.discardChanges() },
  ])("must keep the editor as the user saved it when they $action while the save is in flight", ({ change }) => {
    const { fake, render } = setUpTest();
    fake.api.writeDraft.mockReturnValueOnce(new Promise(() => {}));
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.request(editDraft));
    act(() => void result.current.save());

    act(() => change(result.current));

    expect(result.current).toMatchObject({
      body: "Hourly",
      editingThreadId: 2,
      isSaving: true,
      question: { held: { kind: "edit", threadId: 1 } },
    });
  });

  test("must open the request the user makes while the save is in flight when the save succeeds", async () => {
    const { fake, render } = setUpTest();
    let finishSave = (): void => {};
    fake.api.writeDraft.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = () => resolve();
      })
    );
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    let saving = Promise.resolve();
    act(() => {
      saving = result.current.save();
    });
    act(() => result.current.request(editDraft));

    await act(async () => {
      finishSave();
      await saving;
    });

    expect(result.current).toMatchObject({ body: "Why 24h?", editingThreadId: 1, isSaving: false, question: null });
  });

  test("must hold a request until the save ends when the saved text arrives before the save does", () => {
    const { fake, render } = setUpTest();
    fake.api.writeDraft.mockReturnValueOnce(new Promise(() => {}));
    const { rerender, result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => void result.current.save());
    rerender({ shown: [draftComment, { ...openThread, draft: { at: testTime, body: "Hourly" } }] });

    act(() => result.current.request(editDraft));

    expect(result.current).toMatchObject({ editingThreadId: 2, question: { held: { kind: "edit", threadId: 1 } } });
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

  test("must ask again when the user starts yet another comment while asked", () => {
    const { render } = setUpTest();
    const { result } = render();
    act(() => result.current.request(reply));
    act(() => result.current.changeBody("Hourly"));
    act(() => result.current.request(editDraft));
    const questionRevision = result.current.questionRevision;

    act(() => result.current.request(reviewComment));

    expect(result.current.questionRevision).toBeGreaterThan(questionRevision);
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
