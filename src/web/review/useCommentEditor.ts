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
export type HeldRequest =
  | { kind: "comment" }
  | { kind: "edit"; threadId: number }
  | { kind: "reply"; threadId: number };

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
