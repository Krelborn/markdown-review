import { describe, expect, test } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";

import { wholeBlockSpan } from "./wholeBlockSpan";

const documentText = createDocumentText("# Plan\n\nRetries happen three times.\n\nOne more.\n");

describe("wholeBlockSpan", () => {
  test.each([
    { condition: "the passage is a block's whole text", endOffset: 32, expected: { firstBlock: 1, lastBlock: 1 } },
    { condition: "the passage is part of a block", endOffset: 12, expected: null },
    { condition: "the passage is two blocks' whole text", endOffset: 42, expected: { firstBlock: 1, lastBlock: 2 } },
    { condition: "the passage starts on a block's edge and ends inside the next", endOffset: 38, expected: null },
  ])("must return $expected when $condition", ({ endOffset, expected }) => {
    expect(wholeBlockSpan(documentText, 5, endOffset)).toEqual(expected);
  });

  test("must return null when the passage starts inside a block and ends on the next block's edge", () => {
    expect(wholeBlockSpan(documentText, 2, 32)).toBeNull();
  });
});
