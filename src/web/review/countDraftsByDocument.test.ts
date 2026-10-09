import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../shared/review/testing/reviewBuilders";

import { countDraftsByDocument } from "./countDraftsByDocument";

const draft = { at: testTime, body: "Why?" };

describe("countDraftsByDocument", () => {
  test("must count the review's drafts first, then each doc's in path order, and leave out docs without drafts", () => {
    const counts = countDraftsByDocument([
      buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), draft, id: 1 }),
      buildThread({ anchor: buildPassageAnchor(), draft, id: 2, messages: [], status: "draft" }),
      buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, draft, id: 3 }),
      buildThread({ anchor: { kind: "review" }, draft, id: 4 }),
      buildThread({ anchor: buildPassageAnchor({ document: "docs/zebra.md" }), id: 5 }),
    ]);

    expect(counts).toEqual([
      { count: 1, document: null },
      { count: 2, document: "docs/plan.md" },
      { count: 1, document: "docs/spec.md" },
    ]);
  });
});
