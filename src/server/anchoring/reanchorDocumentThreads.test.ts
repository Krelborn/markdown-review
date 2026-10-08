import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread } from "../../shared/review/testing/reviewBuilders";

import { reanchorDocumentThreads } from "./reanchorDocumentThreads";

const passageThread = buildThread({ anchor: buildPassageAnchor(), id: 1 });

const documentThread = buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, id: 2 });

describe("reanchorDocumentThreads", () => {
  test("must move passage threads and leave doc threads alone when the doc has changed", () => {
    const threads = reanchorDocumentThreads(
      [passageThread, documentThread],
      "# Plan\n\nIntro.\n\ncache results for 24h\n"
    );

    expect(threads.map((thread) => thread.anchor)).toEqual([
      { ...passageThread.anchor, endLine: 5, endOffset: 33, prefix: "Plan\nIntro.\n", startLine: 5, startOffset: 12 },
      documentThread.anchor,
    ]);
  });

  test("must mark passage threads outdated and leave doc threads alone when the doc no longer exists", () => {
    const threads = reanchorDocumentThreads([passageThread, documentThread], null);

    expect(threads.map((thread) => thread.anchor)).toEqual([
      { ...passageThread.anchor, outdated: true },
      documentThread.anchor,
    ]);
  });
});
