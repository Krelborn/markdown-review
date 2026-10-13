import { describe, expect, test } from "vitest";

import { isDraftInRound } from "./isDraftInRound";
import type { ReviewRound } from "./reviewRoundSchema";
import { buildPassageAnchor, buildRound, buildThread } from "./testing/reviewBuilders";
import type { Thread } from "./threadSchema";

const beforeRound = "2026-10-08T08:00:00.000Z";

const roundStart = "2026-10-08T09:00:00.000Z";

const afterRoundStart = "2026-10-08T10:00:00.000Z";

const roundOnPlan = buildRound({ documents: ["docs/plan.md"], startedAt: roundStart });

describe("isDraftInRound", () => {
  test.each<{ condition: string; thread: Thread; round: ReviewRound | null; expected: boolean }>([
    { condition: "the thread has no draft", thread: buildThread(), round: roundOnPlan, expected: false },
    { condition: "no review was opened", thread: draftOn("docs/other.md", beforeRound), round: null, expected: true },
    {
      condition: "the draft is on the whole review",
      thread: buildThread({ draft: { at: beforeRound, body: "Overall?" } }),
      round: roundOnPlan,
      expected: true,
    },
    {
      condition: "the draft predates the round but is on a doc opened this round",
      thread: draftOn("docs/plan.md", beforeRound),
      round: roundOnPlan,
      expected: true,
    },
    {
      condition: "the draft predates the round and is on another doc",
      thread: draftOn("docs/other.md", beforeRound),
      round: roundOnPlan,
      expected: false,
    },
    {
      condition: "the draft is on another doc and written since the round began",
      thread: draftOn("docs/other.md", afterRoundStart),
      round: roundOnPlan,
      expected: true,
    },
    {
      condition: "the draft is on another doc and written as the round began",
      thread: draftOn("docs/other.md", roundStart),
      round: roundOnPlan,
      expected: true,
    },
    {
      condition: "an old draft on another doc was edited since the round began",
      thread: buildThread({
        anchor: buildPassageAnchor({ document: "docs/other.md" }),
        createdAt: beforeRound,
        draft: { at: afterRoundStart, body: "Why, again?" },
        messages: [],
        status: "draft",
      }),
      round: roundOnPlan,
      expected: true,
    },
  ])("must return $expected when $condition", ({ thread, round, expected }) => {
    expect(isDraftInRound(thread, round)).toBe(expected);
  });
});

function draftOn(document: string, at: string): Thread {
  return buildThread({
    anchor: buildPassageAnchor({ document }),
    createdAt: at,
    draft: { at, body: "Why?" },
    messages: [],
    status: "draft",
  });
}
