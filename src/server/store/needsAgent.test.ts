import { describe, expect, test } from "vitest";

import { buildThread, testTime } from "../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../shared/review/threadSchema";

import { needsAgent } from "./needsAgent";

describe("needsAgent", () => {
  test.each<{ condition: string; thread: Thread; expected: boolean }>([
    { condition: "the thread is open and the user had the last word", thread: buildThread(), expected: true },
    {
      condition: "the agent had the last word",
      thread: buildThread({
        messages: [
          { at: testTime, author: "user", body: "Why?" },
          { at: testTime, author: "agent", body: "Because" },
        ],
      }),
      expected: false,
    },
    { condition: "the thread is resolved", thread: buildThread({ status: "resolved" }), expected: false },
    {
      condition: "the thread is a draft",
      thread: buildThread({ draft: { at: testTime, body: "Why?" }, messages: [], status: "draft" }),
      expected: false,
    },
  ])("must return $expected when $condition", ({ thread, expected }) => {
    expect(needsAgent(thread)).toBe(expected);
  });
});
