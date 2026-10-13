import { describe, expect, test } from "vitest";

import type { Verdict } from "../review/reviewRoundSchema";

import {
  agentOpenRequestSchema,
  messageRequestSchema,
  resolveRequestSchema,
  submitRequestSchema,
} from "./apiRequestSchemas";

describe("apiRequestSchemas", () => {
  test("must accept an open request when it names a repo-relative doc or no doc", () => {
    expect(agentOpenRequestSchema.safeParse({ path: "docs/plan.md" }).success).toBe(true);
    expect(agentOpenRequestSchema.safeParse({}).success).toBe(true);
  });

  test("must refuse an open request when its path leaves the repo", () => {
    expect(agentOpenRequestSchema.safeParse({ path: "../secret.md" }).success).toBe(false);
  });

  test("must refuse a reply or draft when its body is blank", () => {
    expect(messageRequestSchema.safeParse({ body: "  " }).success).toBe(false);
  });

  test("must accept a resolve request when it has no message", () => {
    expect(resolveRequestSchema.safeParse({ body: null }).success).toBe(true);
  });

  test("must accept an open request when it gives the agent's next task", () => {
    expect(agentOpenRequestSchema.safeParse({ nextTask: "implement the plan", path: "docs/plan.md" }).success).toBe(
      true
    );
  });

  test.each([
    { condition: "it is blank", nextTask: " " },
    { condition: "it has more than one line", nextTask: "implement the plan\nthen ship it" },
    { condition: "it is longer than 200 characters", nextTask: "a".repeat(201) },
  ])("must refuse an open request when its next task $condition", ({ nextTask }) => {
    expect(agentOpenRequestSchema.safeParse({ nextTask, path: "docs/plan.md" }).success).toBe(false);
  });

  test.each<{ verdict: Verdict }>([{ verdict: "go-ahead" }, { verdict: "hand-back" }, { verdict: "revise" }])(
    "must accept a submit when the verdict is $verdict",
    ({ verdict }) => {
      expect(submitRequestSchema.safeParse({ verdict }).success).toBe(true);
    }
  );
});
