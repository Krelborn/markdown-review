import { describe, expect, test } from "vitest";

import type { ReviewRound } from "./reviewRoundSchema";
import type { RoundOutcome } from "./roundOutcome";
import { roundOutcome } from "./roundOutcome";
import { buildRound, testTime } from "./testing/reviewBuilders";

describe("roundOutcome", () => {
  test.each<{ condition: string; round: ReviewRound | null; expected: RoundOutcome | null }>([
    { condition: "no review was opened", round: null, expected: null },
    { condition: "the user has not submitted", round: buildRound(), expected: null },
    {
      condition: "the user asked for revisions",
      round: buildRound({ verdict: { at: testTime, kind: "revise" } }),
      expected: null,
    },
    {
      condition: "the user said go ahead",
      round: buildRound({ verdict: { at: testTime, kind: "go-ahead" } }),
      expected: "go-ahead",
    },
    {
      condition: "the user handed the review back",
      round: buildRound({ verdict: { at: testTime, kind: "hand-back" } }),
      expected: "hand-back",
    },
  ])("must return $expected when $condition", ({ round, expected }) => {
    expect(roundOutcome(round)).toBe(expected);
  });
});
