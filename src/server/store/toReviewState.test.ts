import { describe, expect, test } from "vitest";

import { toReviewState } from "./toReviewState";

const earlier = "2026-10-08T09:00:00.000Z";

const later = "2026-10-08T10:00:00.000Z";

describe("toReviewState", () => {
  test.each([
    { condition: "the user has never approved", requestedAt: earlier, approvedAt: null, expected: false },
    {
      condition: "the user approved after the latest request",
      requestedAt: earlier,
      approvedAt: later,
      expected: true,
    },
    {
      condition: "the agent requested a review after the approval",
      requestedAt: later,
      approvedAt: earlier,
      expected: false,
    },
    { condition: "the user approved before any request", requestedAt: null, approvedAt: earlier, expected: true },
  ])("must report approved as $expected when $condition", ({ requestedAt, approvedAt, expected }) => {
    expect(toReviewState({ approvedAt, requestedAt })).toEqual({ approved: expected, approvedAt, requestedAt });
  });
});
