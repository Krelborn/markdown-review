import { describe, expect, test } from "vitest";

import { reviewRoundSchema } from "./reviewRoundSchema";
import { buildRound } from "./testing/reviewBuilders";

describe("reviewRoundSchema", () => {
  test("must trim the next task when it has spaces around it", () => {
    const round = buildRound({ nextTask: "  implement the plan  " });

    expect(reviewRoundSchema.parse(round).nextTask).toBe("implement the plan");
  });

  test.each([
    { condition: "it is blank", nextTask: "  " },
    { condition: "it has more than one line", nextTask: "implement the plan\nthen ship it" },
    { condition: "it is longer than 200 characters", nextTask: "a".repeat(201) },
  ])("must reject the next task when $condition", ({ nextTask }) => {
    expect(reviewRoundSchema.safeParse(buildRound({ nextTask })).success).toBe(false);
  });

  test("must accept the next task when it is one line of 200 characters", () => {
    expect(reviewRoundSchema.safeParse(buildRound({ nextTask: "a".repeat(200) })).success).toBe(true);
  });
});
