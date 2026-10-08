import { describe, expect, test } from "vitest";

import { createDocumentText } from "./createDocumentText";
import { linesForRange } from "./linesForRange";

const documentText = createDocumentText("# Title\n\nPara one\nline two\n\n```\nx\ny\n```\n");

describe("linesForRange", () => {
  test.each([
    { condition: "the range is one word on a paragraph's second line", start: 15, end: 19, expected: [4, 4] },
    { condition: "the range runs from the title into a fence", start: 0, end: 27, expected: [1, 8] },
    { condition: "the range ends with the newline after a block", start: 0, end: 6, expected: [1, 1] },
    { condition: "the range is empty", start: 6, end: 6, expected: [3, 3] },
  ])("must return lines $expected when $condition", ({ start, end, expected }) => {
    expect(linesForRange(documentText, start, end)).toEqual({ endLine: expected[1], startLine: expected[0] });
  });

  test("must return a range containing the text when a code span hides a line break before it", () => {
    const wrapped = createDocumentText("Use `a\nb` here\nand more\n");
    const start = wrapped.text.indexOf("more");

    expect(linesForRange(wrapped, start, start + "more".length)).toEqual({ endLine: 3, startLine: 2 });
  });
});
