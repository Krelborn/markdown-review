import { describe, expect, test } from "vitest";

import type { Verdict } from "./apiRequestSchemas";
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

  test.each<{ verdict: Verdict }>([{ verdict: "approve" }, { verdict: "request-changes" }])(
    "must accept a submit when the verdict is $verdict",
    ({ verdict }) => {
      expect(submitRequestSchema.safeParse({ verdict }).success).toBe(true);
    }
  );
});
