import { describe, expect, test } from "vitest";

import type { NewPassageAnchor, NewThread } from "./newThreadSchema";
import { newThreadSchema } from "./newThreadSchema";

const selection: NewPassageAnchor = {
  document: "docs/plan.md",
  endOffset: 9,
  kind: "passage",
  prefix: "",
  quote: "cache res",
  startOffset: 0,
  suffix: "",
};

describe("newThreadSchema", () => {
  test("must accept a passage comment when its offsets span exactly its quote", () => {
    const newThread: NewThread = { anchor: selection, body: "Why?", renderedHash: "abc" };

    expect(newThreadSchema.safeParse(newThread).success).toBe(true);
  });

  test("must reject a passage comment when its offsets do not span its quote", () => {
    const newThread: NewThread = { anchor: { ...selection, endOffset: 4 }, body: "Why?" };

    expect(newThreadSchema.safeParse(newThread).success).toBe(false);
  });

  test("must reject a comment when its body is blank", () => {
    const newThread: NewThread = { anchor: { kind: "review" }, body: " \n " };

    expect(newThreadSchema.safeParse(newThread).success).toBe(false);
  });
});
