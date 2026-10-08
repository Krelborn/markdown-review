import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "./testing/reviewBuilders";
import type { Thread } from "./threadSchema";
import { threadSchema } from "./threadSchema";

describe("threadSchema", () => {
  test.each<{ condition: string; thread: Thread }>([
    { condition: "it is an open thread on the review", thread: buildThread() },
    {
      condition: "it is a draft thread holding its comment",
      thread: buildThread({ draft: { at: testTime, body: "Why?" }, messages: [], status: "draft" }),
    },
    {
      condition: "it is a resolved passage thread with a draft reply",
      thread: buildThread({
        anchor: buildPassageAnchor(),
        draft: { at: testTime, body: "Not yet" },
        status: "resolved",
      }),
    },
  ])("must accept a thread when $condition", ({ thread }) => {
    expect(threadSchema.safeParse(thread).success).toBe(true);
  });

  test.each<{ condition: string; thread: Thread }>([
    { condition: "a draft thread has submitted messages", thread: buildThread({ status: "draft" }) },
    { condition: "an open thread has no messages", thread: buildThread({ messages: [] }) },
    { condition: "a draft thread has no draft", thread: buildThread({ messages: [], status: "draft" }) },
    {
      condition: "a message is blank",
      thread: buildThread({ messages: [{ at: testTime, author: "user", body: "  " }] }),
    },
    {
      condition: "a passage ends before it starts",
      thread: buildThread({ anchor: buildPassageAnchor({ endLine: 2, startLine: 3 }) }),
    },
    {
      condition: "a passage's doc is outside the repo",
      thread: buildThread({ anchor: buildPassageAnchor({ document: "../secrets.md" }) }),
    },
  ])("must reject a thread when $condition", ({ thread }) => {
    expect(threadSchema.safeParse(thread).success).toBe(false);
  });
});
