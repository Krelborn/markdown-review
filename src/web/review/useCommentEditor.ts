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
