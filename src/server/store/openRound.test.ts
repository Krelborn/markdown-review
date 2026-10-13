import { describe, expect, test } from "vitest";

import type { ReviewRound } from "../../shared/review/reviewRoundSchema";
import { buildRound } from "../../shared/review/testing/reviewBuilders";

import { openRound } from "./openRound";

const opened = "2026-10-12T09:00:00.000Z";

const submitted = "2026-10-12T10:00:00.000Z";

const soonAfter = "2026-10-12T11:00:00.000Z";

const justUnderTwelveHoursAfterSubmit = "2026-10-12T21:59:59.999Z";

const twelveHoursAfterSubmit = "2026-10-12T22:00:00.000Z";

describe("openRound", () => {
  test("must start a round on the doc when no review was opened", () => {
    expect(openRound(null, "docs/plan.md", "implement the plan", opened)).toEqual<ReviewRound>({
      documents: ["docs/plan.md"],
      lastOpenedAt: opened,
      nextTask: "implement the plan",
      startedAt: opened,
      verdict: null,
    });
  });

  test("must start a round on no doc when the agent opens the docs list", () => {
    expect(openRound(null, null, null, opened).documents).toEqual([]);
  });

  test("must add a new doc to the round when the round is going on", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened });

    expect(openRound(round, "docs/spec.md", null, soonAfter)).toEqual<ReviewRound>({
      ...round,
      documents: ["docs/plan.md", "docs/spec.md"],
      lastOpenedAt: soonAfter,
    });
  });

  test("must list a doc once when the agent opens it again", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened });

    expect(openRound(round, "docs/plan.md", null, soonAfter).documents).toEqual(["docs/plan.md"]);
  });

  test.each([
    { condition: "none is given", nextTask: null, expected: "implement the plan" },
    { condition: "one is given", nextTask: "write the tests", expected: "write the tests" },
  ])("must set the next task to $expected when joining and $condition", ({ nextTask, expected }) => {
    const round = buildRound({ lastOpenedAt: opened, nextTask: "implement the plan", startedAt: opened });

    expect(openRound(round, "docs/plan.md", nextTask, soonAfter).nextTask).toBe(expected);
  });

  test("must join the round when the user asked for revisions just under 12 hours ago", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened, verdict: { at: submitted, kind: "revise" } });

    expect(openRound(round, "docs/plan.md", null, justUnderTwelveHoursAfterSubmit).startedAt).toBe(opened);
  });

  test("must start a new round at the open when the last open and submit are 12 hours old", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened, verdict: { at: submitted, kind: "revise" } });

    expect(openRound(round, "docs/spec.md", null, twelveHoursAfterSubmit)).toEqual<ReviewRound>({
      documents: ["docs/spec.md"],
      lastOpenedAt: twelveHoursAfterSubmit,
      nextTask: null,
      startedAt: twelveHoursAfterSubmit,
      verdict: null,
    });
  });

  test.each([{ kind: "go-ahead" as const }, { kind: "hand-back" as const }])(
    "must start a new round at the previous round's end when the user chose $kind within 12 hours",
    ({ kind }) => {
      const round = buildRound({ lastOpenedAt: opened, startedAt: opened, verdict: { at: submitted, kind } });

      expect(openRound(round, "docs/plan.md", null, soonAfter)).toEqual<ReviewRound>({
        documents: ["docs/plan.md"],
        lastOpenedAt: soonAfter,
        nextTask: null,
        startedAt: submitted,
        verdict: null,
      });
    }
  );

  test("must start a new round at the open when the previous round ended 12 hours ago", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened, verdict: { at: submitted, kind: "go-ahead" } });

    expect(openRound(round, "docs/plan.md", null, twelveHoursAfterSubmit).startedAt).toBe(twelveHoursAfterSubmit);
  });
});
