import { describe, expect, test } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";
import type { DocumentStructure } from "../../shared/markdown/DocumentStructure";

import { describeStructure } from "./describeStructure";

const documentText = createDocumentText("## Retry policy\n\nRetries happen three times.\n");

describe("describeStructure", () => {
  test.each<{ expected: string; structure: DocumentStructure }>([
    { expected: "the table", structure: { depth: 0, firstBlock: 0, kind: "table", lastBlock: 1 } },
    { expected: "the list", structure: { depth: 0, firstBlock: 0, kind: "list", lastBlock: 1 } },
    { expected: "the quote", structure: { depth: 0, firstBlock: 0, kind: "quote", lastBlock: 1 } },
    {
      expected: "the warning",
      structure: { alertKind: "warning", depth: 0, firstBlock: 0, kind: "alert", lastBlock: 1 },
    },
    {
      expected: "the section “Retry policy”",
      structure: { depth: 0, firstBlock: 0, kind: "section", lastBlock: 1 },
    },
  ])("must call it $expected when the structure is a $structure.kind", ({ expected, structure }) => {
    expect(describeStructure(documentText, structure)).toBe(expected);
  });
});
