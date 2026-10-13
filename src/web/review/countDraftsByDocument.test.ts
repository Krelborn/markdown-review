import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildRound, buildThread, testTime } from "../../shared/review/testing/reviewBuilders";

import { countDraftsByDocument } from "./countDraftsByDocument";

const draft = { at: testTime, body: "Why?" };

const staleDraft = { at: "2026-10-01T09:00:00.000Z", body: "Why?" };

describe("countDraftsByDocument", () => {
  test("must count the review's drafts first, then each doc's in path order, and leave out docs without drafts", () => {
    const counts = countDraftsByDocument(
      [
        buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), draft, id: 1 }),
        buildThread({ anchor: buildPassageAnchor(), draft, id: 2, messages: [], status: "draft" }),
        buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, draft, id: 3 }),
        buildThread({ anchor: { kind: "review" }, draft, id: 4 }),
        buildThread({ anchor: buildPassageAnchor({ document: "docs/zebra.md" }), id: 5 }),
      ],
      null
    );

    expect(counts.sent).toEqual([
      { count: 1, document: null },
      { count: 2, document: "docs/plan.md" },
      { count: 1, document: "docs/spec.md" },
    ]);
  });

  test("must count a draft as kept when it is from before the round on a doc the round has not opened", () => {
    const counts = countDraftsByDocument(
      [
        buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), draft: staleDraft, id: 1 }),
        buildThread({ anchor: buildPassageAnchor({ document: "docs/plan.md" }), draft: staleDraft, id: 2 }),
        buildThread({ anchor: buildPassageAnchor({ document: "docs/zebra.md" }), draft, id: 3 }),
      ],
      buildRound({ documents: ["docs/plan.md"], startedAt: testTime })
    );

    expect(counts).toEqual({
      kept: [{ count: 1, document: "docs/spec.md" }],
      sent: [
        { count: 1, document: "docs/plan.md" },
        { count: 1, document: "docs/zebra.md" },
      ],
    });
  });
});
