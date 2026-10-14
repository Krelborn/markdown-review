import { describe, expect, test } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";

import { innermostStructure } from "./innermostStructure";

const documentText = createDocumentText(
  "# Plan\n\nIntro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- x\n  - y\n  - z\n- w\n"
);

describe("innermostStructure", () => {
  test.each([
    { block: "the heading", blockIndex: 0, expected: { firstBlock: 0, kind: "section", lastBlock: 7 } },
    {
      block: "a paragraph under the heading",
      blockIndex: 1,
      expected: { firstBlock: 0, kind: "section", lastBlock: 7 },
    },
    { block: "a table row", blockIndex: 3, expected: { firstBlock: 2, kind: "table", lastBlock: 3 } },
    { block: "an item of the nested list", blockIndex: 5, expected: { firstBlock: 5, kind: "list", lastBlock: 6 } },
    { block: "an item of the outer list", blockIndex: 7, expected: { firstBlock: 4, kind: "list", lastBlock: 7 } },
  ])(
    "must offer the $expected.kind from $expected.firstBlock to $expected.lastBlock when the block is $block",
    ({ blockIndex, expected }) => {
      expect(innermostStructure(documentText, blockIndex)).toMatchObject(expected);
    }
  );

  test("must offer the structure nested deeper when two structures hold the same blocks", () => {
    expect(innermostStructure(createDocumentText("> - a\n> - b\n"), 0)).toMatchObject({ depth: 1, kind: "list" });
  });

  test("must offer nothing when no structure holds the block", () => {
    expect(innermostStructure(createDocumentText("Just a paragraph.\n"), 0)).toBeNull();
  });
});
