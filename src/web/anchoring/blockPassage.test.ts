import { describe, expect, test } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";

import { blockPassage } from "./blockPassage";

const documentText = createDocumentText("# Plan\n\nRetries happen three times.\n\nOne more.\n");

describe("blockPassage", () => {
  test("must quote the block's whole text when the span is one block", () => {
    expect(blockPassage(documentText, "docs/plan.md", { firstBlock: 1, lastBlock: 1 })).toEqual({
      document: "docs/plan.md",
      endOffset: 32,
      kind: "passage",
      prefix: "Plan\n",
      quote: "Retries happen three times.",
      startOffset: 5,
      suffix: "\nOne more.",
    });
  });

  test("must quote every block from the first to the last when the span is several blocks", () => {
    expect(blockPassage(documentText, "docs/plan.md", { firstBlock: 0, lastBlock: 1 })).toEqual({
      document: "docs/plan.md",
      endOffset: 32,
      kind: "passage",
      prefix: "",
      quote: "Plan\nRetries happen three times.",
      startOffset: 0,
      suffix: "\nOne more.",
    });
  });

  test("must return null when the doc has no such block", () => {
    expect(blockPassage(documentText, "docs/plan.md", { firstBlock: 1, lastBlock: 3 })).toBeNull();
  });
});
