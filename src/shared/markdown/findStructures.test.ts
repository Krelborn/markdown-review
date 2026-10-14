import { describe, expect, test } from "vitest";

import { createMarkdownIt } from "./createMarkdownIt";
import type { DocumentStructure } from "./DocumentStructure";
import { findLeafBlocks } from "./findLeafBlocks";
import { findStructures } from "./findStructures";

describe("findStructures", () => {
  test.each<{ condition: string; source: string; expected: DocumentStructure[] }>([
    {
      condition: "the doc has a table",
      source: "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n",
      expected: [{ depth: 0, firstBlock: 0, kind: "table", lastBlock: 2 }],
    },
    {
      condition: "a bullet list has a nested list",
      source: "- a\n  - b\n  - c\n- d\n",
      expected: [
        { depth: 0, firstBlock: 0, kind: "list", lastBlock: 3 },
        { depth: 2, firstBlock: 1, kind: "list", lastBlock: 2 },
      ],
    },
    {
      condition: "the doc has an ordered list",
      source: "1. a\n2. b\n",
      expected: [{ depth: 0, firstBlock: 0, kind: "list", lastBlock: 1 }],
    },
    {
      condition: "a quote holds a list",
      source: "> intro\n>\n> - a\n> - b\n",
      expected: [
        { depth: 0, firstBlock: 0, kind: "quote", lastBlock: 2 },
        { depth: 1, firstBlock: 1, kind: "list", lastBlock: 2 },
      ],
    },
    {
      condition: "headings of three ranks divide the doc",
      source: "# A\n\nAa\n\n## B\n\nBb\n\n### C\n\nCc\n\n## D\n\nDd\n",
      expected: [
        { depth: 0, firstBlock: 0, kind: "section", lastBlock: 7 },
        { depth: 0, firstBlock: 2, kind: "section", lastBlock: 5 },
        { depth: 0, firstBlock: 4, kind: "section", lastBlock: 5 },
        { depth: 0, firstBlock: 6, kind: "section", lastBlock: 7 },
      ],
    },
    {
      condition: "the headings are setext headings",
      source: "Title\n=====\n\nIntro\n\nPart\n----\n\nBody\n",
      expected: [
        { depth: 0, firstBlock: 0, kind: "section", lastBlock: 3 },
        { depth: 0, firstBlock: 2, kind: "section", lastBlock: 3 },
      ],
    },
    {
      condition: "headings sit in a list and a quote",
      source: "- item\n\n  ## Inside\n\n> ## Quoted\n>\n> Text\n",
      expected: [
        { depth: 0, firstBlock: 0, kind: "list", lastBlock: 1 },
        { depth: 0, firstBlock: 2, kind: "quote", lastBlock: 3 },
      ],
    },
    {
      condition: "frontmatter comes before the first heading",
      source: "---\ntitle: Plan\n---\n\n# Plan\n\nIntro\n",
      expected: [{ depth: 0, firstBlock: 1, kind: "section", lastBlock: 2 }],
    },
    {
      condition: "a list has one item and a heading has nothing under it",
      source: "# Empty\n\n# Full\n\n- only\n",
      expected: [{ depth: 0, firstBlock: 1, kind: "section", lastBlock: 2 }],
    },
  ])("must find each structure when $condition", ({ expected, source }) => {
    expect(structuresOf(source)).toEqual(expected);
  });

  test.each(["note", "tip", "important", "warning", "caution"])(
    "must find the alert and its kind when the doc has a %s alert",
    (alertKind) => {
      expect(structuresOf(`> [!${alertKind.toUpperCase()}]\n> One\n>\n> Two\n`)).toEqual([
        { alertKind, depth: 0, firstBlock: 0, kind: "alert", lastBlock: 1 },
      ]);
    }
  );
});

function structuresOf(source: string): DocumentStructure[] {
  const tokens = createMarkdownIt().parse(source, {});
  return findStructures(tokens, findLeafBlocks(tokens, source));
}
