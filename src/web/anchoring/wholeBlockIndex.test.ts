import { describe, expect, test } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";

import { wholeBlockIndex } from "./wholeBlockIndex";

const documentText = createDocumentText("# Plan\n\nRetries happen three times.\n");

describe("wholeBlockIndex", () => {
  test.each([
    { condition: "the passage is a block's whole text", endOffset: 32, expected: 1, startOffset: 5 },
    { condition: "the passage is part of a block", endOffset: 12, expected: null, startOffset: 5 },
    { condition: "the passage runs across two blocks", endOffset: 32, expected: null, startOffset: 0 },
  ])("must return $expected when $condition", ({ endOffset, expected, startOffset }) => {
    expect(wholeBlockIndex(documentText, startOffset, endOffset)).toBe(expected);
  });
});
