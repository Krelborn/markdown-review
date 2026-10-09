import { describe, expect, test } from "vitest";

import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import type { NewComment } from "./NewComment";
import { pendingPassageOn } from "./pendingPassageOn";

const passage: NewPassageAnchor = {
  document: "docs/plan.md",
  endOffset: 29,
  kind: "passage",
  prefix: "",
  quote: "cache results for 24h",
  startOffset: 8,
  suffix: "",
};

const shown = { hash: "hash-1", path: "docs/plan.md" };

describe("pendingPassageOn", () => {
  test("must find the passage when the comment being written is on a passage of the doc", () => {
    expect(pendingPassageOn({ anchor: passage, renderedHash: "hash-1" }, shown)).toBe(passage);
  });

  test.each<{ condition: string; newComment: NewComment | null }>([
    { condition: "no comment is being written", newComment: null },
    { condition: "the comment is on the whole review", newComment: { anchor: { kind: "review" } } },
    {
      condition: "the comment is on the whole doc",
      newComment: { anchor: { document: "docs/plan.md", kind: "document" } },
    },
    {
      condition: "the comment's passage is on another doc",
      newComment: { anchor: { ...passage, document: "docs/spec.md" }, renderedHash: "hash-1" },
    },
    {
      condition: "the doc has changed since the comment started",
      newComment: { anchor: passage, renderedHash: "hash-0" },
    },
  ])("must find no passage when $condition", ({ newComment }) => {
    expect(pendingPassageOn(newComment, shown)).toBeNull();
  });
});
