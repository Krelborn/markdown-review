import { describe, expect, test } from "vitest";

import type { ReviewRound } from "../../shared/review/reviewRoundSchema";
import { buildRound } from "../../shared/review/testing/reviewBuilders";

import { joinOrStartRound } from "./joinOrStartRound";

const opened = "2026-10-12T09:00:00.000Z";

const submitted = "2026-10-12T10:00:00.000Z";

const soonAfter = "2026-10-12T11:00:00.000Z";

const justUnderTwelveHoursAfterSubmit = "2026-10-12T21:59:59.999Z";

const twelveHoursAfterSubmit = "2026-10-12T22:00:00.000Z";

describe("joinOrStartRound", () => {
  test("must start a round on the doc when no review was opened", () => {
    expect(joinOrStartRound(null, "docs/plan.md", "implement the plan", opened)).toEqual<ReviewRound>({
      documents: ["docs/plan.md"],
      lastOpenedAt: opened,
      nextTask: "implement the plan",
      startedAt: opened,
      verdict: null,
    });
  });

  test("must start a round on no doc when the agent opens the docs list", () => {
    expect(joinOrStartRound(null, null, null, opened).documents).toEqual([]);
  });

  test("must add a new doc to the round when the round is going on", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened });

    expect(joinOrStartRound(round, "docs/spec.md", null, soonAfter)).toEqual<ReviewRound>({
      ...round,
      documents: ["docs/plan.md", "docs/spec.md"],
      lastOpenedAt: soonAfter,
    });
  });

  test("must list a doc once when the agent opens it again", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened });

    expect(joinOrStartRound(round, "docs/plan.md", null, soonAfter).documents).toEqual(["docs/plan.md"]);
  });

  test.each([
    { condition: "none is given", nextTask: null, expected: "implement the plan" },
    { condition: "one is given", nextTask: "write the tests", expected: "write the tests" },
  ])("must set the next task to $expected when joining and $condition", ({ nextTask, expected }) => {
    const round = buildRound({ lastOpenedAt: opened, nextTask: "implement the plan", startedAt: opened });

    expect(joinOrStartRound(round, "docs/plan.md", nextTask, soonAfter).nextTask).toBe(expected);
  });

  test("must join the round when the user asked for revisions just under 12 hours ago", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened, verdict: { at: submitted, kind: "revise" } });

    expect(joinOrStartRound(round, "docs/plan.md", null, justUnderTwelveHoursAfterSubmit).startedAt).toBe(opened);
  });

  test("must start a new round at the open when the last open and submit are 12 hours old", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened, verdict: { at: submitted, kind: "revise" } });

    expect(joinOrStartRound(round, "docs/spec.md", null, twelveHoursAfterSubmit)).toEqual<ReviewRound>({
      documents: ["docs/spec.md"],
      lastOpenedAt: twelveHoursAfterSubmit,
      nextTask: null,
      startedAt: twelveHoursAfterSubmit,
      verdict: null,
    });
  });

  test("must start a new round when the round was opened 12 hours ago and never submitted", () => {
    const round = buildRound({ lastOpenedAt: submitted, startedAt: submitted, verdict: null });

    expect(joinOrStartRound(round, "docs/plan.md", null, twelveHoursAfterSubmit).startedAt).toBe(
      twelveHoursAfterSubmit
    );
  });

  test("must join the round when the last submit is 12 hours old but the last open is recent", () => {
    const round = buildRound({ lastOpenedAt: submitted, startedAt: opened, verdict: { at: opened, kind: "revise" } });

    expect(joinOrStartRound(round, "docs/plan.md", null, justUnderTwelveHoursAfterSubmit).startedAt).toBe(opened);
  });

  test("must start a new round at the user's hand-back when that was within 12 hours", () => {
    const round = buildRound({
      lastOpenedAt: opened,
      startedAt: opened,
      verdict: { at: submitted, kind: "hand-back" },
    });

    expect(joinOrStartRound(round, "docs/plan.md", null, soonAfter)).toEqual<ReviewRound>({
      documents: ["docs/plan.md"],
      lastOpenedAt: soonAfter,
      nextTask: null,
      startedAt: submitted,
      verdict: null,
    });
  });

  test("must start a new round at the open when the user said go ahead within 12 hours", () => {
    const round = buildRound({ lastOpenedAt: opened, startedAt: opened, verdict: { at: submitted, kind: "go-ahead" } });

    expect(joinOrStartRound(round, "docs/plan.md", null, soonAfter).startedAt).toBe(soonAfter);
  });

  test("must start a new round at the open when the user handed the round back 12 hours ago", () => {
    const round = buildRound({
      lastOpenedAt: opened,
      startedAt: opened,
      verdict: { at: submitted, kind: "hand-back" },
    });

    expect(joinOrStartRound(round, "docs/plan.md", null, twelveHoursAfterSubmit).startedAt).toBe(
      twelveHoursAfterSubmit
    );
  });

  test("must start a new round no later than the open when the clock has gone back since the hand-back", () => {
    const round = buildRound({
      lastOpenedAt: opened,
      startedAt: opened,
      verdict: { at: soonAfter, kind: "hand-back" },
    });

    expect(joinOrStartRound(round, "docs/plan.md", null, submitted).startedAt).toBe(submitted);
  });

  test.each([{ kind: "go-ahead" as const }, { kind: "hand-back" as const }])(
    "must start the next round with no next task when the user chose $kind and the agent gives none",
    ({ kind }) => {
      const round = buildRound({ nextTask: "implement the plan", verdict: { at: submitted, kind } });

      expect(joinOrStartRound(round, "docs/spec.md", null, soonAfter).nextTask).toBeNull();
    }
  );
});
