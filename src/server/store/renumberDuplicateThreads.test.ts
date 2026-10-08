import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread } from "../../shared/review/testing/reviewBuilders";

import { renumberDuplicateThreads } from "./renumberDuplicateThreads";

describe("renumberDuplicateThreads", () => {
  test("must change nothing when every ID is unique", () => {
    const files = [
      { document: null, threads: [buildThread({ id: 1 })] },
      { document: "docs/plan.md", threads: [buildThread({ anchor: buildPassageAnchor(), id: 2 })] },
    ];

    expect(renumberDuplicateThreads(files)).toEqual({ files, renumberings: [] });
  });

  test("must move the later-created thread to the next free ID when two branches created the same ID", () => {
    const earlier = buildThread({ createdAt: "2026-10-08T09:00:00.000Z", id: 3 });
    const later = buildThread({ anchor: buildPassageAnchor(), createdAt: "2026-10-08T10:00:00.000Z", id: 3 });
    const other = buildThread({ id: 4 });

    const result = renumberDuplicateThreads([
      { document: "docs/plan.md", threads: [later] },
      { document: null, threads: [earlier, other] },
    ]);

    expect(result).toEqual({
      files: [
        { document: "docs/plan.md", threads: [{ ...later, id: 5 }] },
        { document: null, threads: [earlier, other] },
      ],
      renumberings: [{ document: "docs/plan.md", from: 3, to: 5 }],
    });
  });
});
