import { describe, expect, test } from "vitest";

import { createDocumentText } from "./createDocumentText";
import { lineAtOffset } from "./lineAtOffset";

const documentText = createDocumentText("# Title\n\nPara one\nline two\n\n```\nx\ny\n```\n");

describe("lineAtOffset", () => {
  test.each([
    { condition: "it is the first character of the doc", offset: 0, expected: 1 },
    { condition: "it is the newline that separates two blocks", offset: 5, expected: 1 },
    { condition: "it starts the first line of a paragraph", offset: 6, expected: 3 },
    { condition: "it is the line break inside a paragraph", offset: 14, expected: 3 },
    { condition: "it starts the second line of a paragraph", offset: 15, expected: 4 },
    { condition: "it is on the first line of code in a fence", offset: 24, expected: 7 },
    { condition: "it is on the second line of code in a fence", offset: 26, expected: 8 },
    { condition: "it is past the end of the doc", offset: 99, expected: 8 },
  ])("must return line $expected for a character when $condition", ({ offset, expected }) => {
    expect(lineAtOffset(documentText, offset)).toBe(expected);
  });

  test("must return line 1 when the doc has no blocks", () => {
    expect(lineAtOffset(createDocumentText(""), 0)).toBe(1);
  });
});
