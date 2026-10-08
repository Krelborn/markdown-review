import type { Anchor } from "../../shared/review/anchorSchema";
import type { Thread } from "../../shared/review/threadSchema";

import { StoreError } from "./StoreError";

/**
 * Starts a thread holding the user's comment as a draft
 *
 * @param id the new thread's ID
 * @param anchor what the comment is on
 * @param body the comment
 * @param at the current time, ISO 8601
 * @returns the draft thread
 */
export function createDraftThread(id: number, anchor: Anchor, body: string, at: string): Thread {
  return { anchor, createdAt: at, draft: { at, body }, id, messages: [], status: "draft", updatedAt: at };
}

/**
 * Sets the user's unsubmitted text: the comment on a draft thread, otherwise a reply
 *
 * @param thread the thread
 * @param body the text
 * @param at the current time, ISO 8601
 * @returns the thread with its draft replaced
 */
export function writeDraft(thread: Thread, body: string, at: string): Thread {
  return { ...thread, draft: { at, body }, updatedAt: at };
}

/**
 * Discards the user's unsubmitted text
 *
 * @param thread the thread
 * @param at the current time, ISO 8601
 * @returns the thread without its draft, or null when it was a draft thread, which no longer exists
 * @throws StoreError "invalid-state" when the thread has no draft
 */
export function deleteDraft(thread: Thread, at: string): Thread | null {
  if (thread.draft === undefined) {
    throw new StoreError("invalid-state", `Thread #${thread.id} has no draft to delete`);
  }
  if (thread.status === "draft") {
    return null;
  }
  return { ...withoutDraft(thread), updatedAt: at };
}

/**
 * Resolves a thread at the user's request; a pending draft reply is kept
 *
 * @param thread the thread
 * @param at the current time, ISO 8601
 * @returns the resolved thread, unchanged when it was already resolved
 * @throws StoreError "invalid-state" when the thread is a draft
 */
export function resolveAsUser(thread: Thread, at: string): Thread {
  if (thread.status === "draft") {
    throw new StoreError("invalid-state", `Thread #${thread.id} is a draft; delete it instead of resolving it`);
  }
  if (thread.status === "resolved") {
    return thread;
  }
  return { ...thread, status: "resolved", updatedAt: at };
}

/**
 * Turns the user's draft into a submitted message, opening the thread
 *
 * @param thread the thread
 * @param at the submit time, ISO 8601, which the message is stamped with
 * @returns the open thread with the draft appended as a user message, or the thread unchanged when it has no draft
 */
export function submitDraft(thread: Thread, at: string): Thread {
  if (thread.draft === undefined) {
    return thread;
  }
  return {
    ...withoutDraft(thread),
    messages: [...thread.messages, { at, author: "user", body: thread.draft.body }],
    status: "open",
    updatedAt: at,
  };
}

/**
 * Adds the agent's answer to a thread without changing its status
 *
 * @param thread a thread that is not a draft
 * @param body the answer
 * @param at the current time, ISO 8601
 * @returns the thread with the agent message appended
 */
export function replyAsAgent(thread: Thread, body: string, at: string): Thread {
  return { ...thread, messages: [...thread.messages, { at, author: "agent", body }], updatedAt: at };
}

/**
 * Resolves a thread at the agent's request
 *
 * @param thread a thread that is not a draft
 * @param body what the agent changed, or null to resolve without a message
 * @param at the current time, ISO 8601
 * @returns the resolved thread
 */
export function resolveAsAgent(thread: Thread, body: string | null, at: string): Thread {
  const answered = body === null ? thread : replyAsAgent(thread, body, at);
  return { ...answered, status: "resolved", updatedAt: at };
}

function withoutDraft(thread: Thread): Thread {
  const next = { ...thread };
  delete next.draft;
  return next;
}
