import { describe, expect, test } from "vitest";

import { createDocumentText } from "./createDocumentText";

describe("createDocumentText", () => {
  test("must join the blocks' text with newlines and record where each block starts when the doc has several blocks", () => {
    const documentText = createDocumentText("# Title\n\nPara one\nline two\n\n```\nx\n```\n");

    expect(documentText.text).toBe("Title\nPara one\nline two\nx");
    expect(documentText.blockStartOffsets).toEqual([0, 6, 24]);
  });

  test("must give empty text when the doc has no blocks", () => {
    const documentText = createDocumentText("");

    expect(documentText).toEqual({ blockStartOffsets: [], blocks: [], text: "" });
  });
});
