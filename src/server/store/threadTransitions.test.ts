import { describe, expect, test } from "vitest";

import { buildThread, testTime } from "../../shared/review/testing/reviewBuilders";

import { StoreError } from "./StoreError";
import {
  createDraftThread,
  deleteDraft,
  replyAsAgent,
  resolveAsAgent,
  resolveAsUser,
  submitDraft,
  writeDraft,
} from "./threadTransitions";

const later = "2026-10-08T10:00:00.000Z";

const draftThread = createDraftThread(1, { kind: "review" }, "Why 24h?", testTime);

describe("threadTransitions", () => {
  test("must hold the comment as the draft and no messages when a thread is created", () => {
    expect(draftThread).toEqual({
      anchor: { kind: "review" },
      createdAt: testTime,
      draft: { at: testTime, body: "Why 24h?" },
      id: 1,
      messages: [],
      status: "draft",
      updatedAt: testTime,
    });
  });

  test("must keep the status and messages when the user writes a reply to an open thread", () => {
    const thread = writeDraft(buildThread(), "Still unclear", later);

    expect(thread).toEqual({ ...buildThread(), draft: { at: later, body: "Still unclear" }, updatedAt: later });
  });

  test("must delete the thread when the user deletes the draft of a draft thread", () => {
    expect(deleteDraft(draftThread, later)).toBeNull();
  });

  test("must keep the thread without its draft when the user deletes a draft reply", () => {
    const thread = buildThread({ draft: { at: testTime, body: "Still unclear" } });

    expect(deleteDraft(thread, later)).toEqual({ ...buildThread(), updatedAt: later });
  });

  test("must refuse when the user deletes a draft from a thread that has none", () => {
    expect(() => deleteDraft(buildThread(), later)).toThrow(StoreError);
  });

  test("must refuse when the user resolves a draft thread", () => {
    expect(() => resolveAsUser(draftThread, later)).toThrow(StoreError);
  });

  test("must keep a pending draft reply when the user resolves a thread", () => {
    const thread = buildThread({ draft: { at: testTime, body: "Still unclear" } });

    expect(resolveAsUser(thread, later)).toEqual({ ...thread, status: "resolved", updatedAt: later });
  });

  test("must open the thread with the comment as its first message when a draft thread is submitted", () => {
    expect(submitDraft(draftThread, later)).toEqual({
      ...draftThread,
      draft: undefined,
      messages: [{ at: later, author: "user", body: "Why 24h?" }],
      status: "open",
      updatedAt: later,
    });
  });

  test("must reopen the thread when a draft reply to a resolved thread is submitted", () => {
    const thread = buildThread({ draft: { at: testTime, body: "Not fixed" }, status: "resolved" });

    const submitted = submitDraft(thread, later);

    expect(submitted.status).toBe("open");
    expect(submitted.messages.at(-1)).toEqual({ at: later, author: "user", body: "Not fixed" });
  });

  test("must place the user's reply after an agent reply that arrived while it was a draft when it is submitted", () => {
    const withDraft = writeDraft(buildThread(), "Any update?", testTime);
    const answered = replyAsAgent(withDraft, "Looking into it", later);

    const submitted = submitDraft(answered, "2026-10-08T11:00:00.000Z");

    expect(submitted.messages.map(({ author, body }) => `${author}: ${body}`)).toEqual([
      "user: Why 24h?",
      "agent: Looking into it",
      "user: Any update?",
    ]);
  });

  test("must leave the thread unchanged when a thread without a draft is submitted", () => {
    expect(submitDraft(buildThread(), later)).toEqual(buildThread());
  });

  test("must keep a resolved thread resolved when the agent replies to it", () => {
    const thread = replyAsAgent(buildThread({ status: "resolved" }), "Done", later);

    expect(thread.status).toBe("resolved");
  });

  test("must resolve without adding a message when the agent resolves with no text", () => {
    expect(resolveAsAgent(buildThread(), null, later)).toEqual({
      ...buildThread(),
      status: "resolved",
      updatedAt: later,
    });
  });

  test("must add the agent's message and resolve when the agent resolves with text", () => {
    const thread = resolveAsAgent(buildThread(), "Changed to 1h", later);

    expect(thread.status).toBe("resolved");
    expect(thread.messages.at(-1)).toEqual({ at: later, author: "agent", body: "Changed to 1h" });
  });
});
