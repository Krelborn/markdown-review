import { describe, expect, test } from "vitest";

import type { ReviewRound } from "../../shared/review/reviewRoundSchema";
import { buildPassageAnchor, buildThread } from "../../shared/review/testing/reviewBuilders";

import { storedReviewFileSchema } from "./storedReviewFileSchema";

const requested = "2026-10-08T09:00:00.000Z";

const earlier = "2026-10-08T08:00:00.000Z";

const later = "2026-10-08T10:00:00.000Z";

const openedRound: ReviewRound = {
  documents: [],
  lastOpenedAt: requested,
  nextTask: null,
  startedAt: requested,
  verdict: null,
};

describe("storedReviewFileSchema", () => {
  test.each<{ condition: string; approvedAt: string | null; requestedAt: string | null; round: ReviewRound | null }>([
    { condition: "no review was ever opened", approvedAt: earlier, requestedAt: null, round: null },
    {
      condition: "the user approved after the latest open",
      approvedAt: later,
      requestedAt: requested,
      round: { ...openedRound, verdict: { at: later, kind: "go-ahead" } },
    },
    {
      condition: "the user approved before the latest open",
      approvedAt: earlier,
      requestedAt: requested,
      round: openedRound,
    },
    { condition: "the user never approved", approvedAt: null, requestedAt: requested, round: openedRound },
    {
      condition: "the user approved at the moment of the latest open",
      approvedAt: requested,
      requestedAt: requested,
      round: openedRound,
    },
  ])("must read a version 1 file with the matching round when $condition", ({ approvedAt, requestedAt, round }) => {
    expect(storedReviewFileSchema.parse({ approvedAt, requestedAt, threads: [], version: 1 })).toEqual({
      round,
      threads: [],
      version: 2,
    });
  });

  test("must refuse a version 1 file when it holds a thread on a doc", () => {
    const file = {
      approvedAt: null,
      requestedAt: null,
      threads: [buildThread({ anchor: buildPassageAnchor() })],
      version: 1,
    };

    expect(storedReviewFileSchema.safeParse(file).success).toBe(false);
  });
});
