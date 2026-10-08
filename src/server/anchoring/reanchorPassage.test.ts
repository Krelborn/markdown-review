import { describe, expect, test } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";
import { linesForRange } from "../../shared/markdown/linesForRange";
import type { PassageAnchor } from "../../shared/review/anchorSchema";

import { reanchorPassage } from "./reanchorPassage";

const plan = "# Plan\n\nWe cache results for 24h.\n";

describe("reanchorPassage", () => {
  test("must leave the anchor unchanged when the doc has not changed", () => {
    const anchor = anchorOn(plan, "cache results for 24h");

    expect(reanchorPassage(anchor, createDocumentText(plan))).toEqual(anchor);
  });

  test("must move the anchor and its lines when a paragraph is inserted above it", () => {
    const anchor = anchorOn(plan, "cache results for 24h");

    const moved = reanchorPassage(
      anchor,
      createDocumentText("# Plan\n\nIntro paragraph.\n\nWe cache results for 24h.\n")
    );

    expect(moved).toEqual({
      ...anchor,
      endLine: 5,
      endOffset: 46,
      prefix: "Plan\nIntro paragraph.\nWe ",
      startLine: 5,
      startOffset: 25,
    });
  });

  test("must choose the occurrence whose surrounding text matches when the text appears twice", () => {
    const source = "# A\n\nRetry three times.\n\n# B\n\nRetry three times.\n";
    const anchor = anchorOn(source, "Retry three times", 1);

    const moved = reanchorPassage(anchor, createDocumentText(`Intro.\n\n${source}`));

    expect([moved.startLine, moved.outdated]).toEqual([9, false]);
  });

  test("must follow the text when the agent edits it within the error budget", () => {
    const anchor = anchorOn(plan, "cache results for 24h");

    const moved = reanchorPassage(anchor, createDocumentText("# Plan\n\nWe cache results for 1h.\n"));

    expect(moved).toMatchObject({
      anchoredText: "cache results for 1h",
      outdated: false,
      quote: "cache results for 24h",
    });
  });

  test("must follow the text across two edits that each stay within the error budget", () => {
    const anchor = anchorOn(plan, "cache results for 24h");

    const afterFirstEdit = reanchorPassage(anchor, createDocumentText("# Plan\n\nWe cache results for 1h.\n"));
    const afterSecondEdit = reanchorPassage(
      afterFirstEdit,
      createDocumentText("# Plan\n\nWe cache all results for 1h.\n")
    );

    expect(afterSecondEdit).toMatchObject({ anchoredText: "cache all results for 1h", outdated: false });
  });

  test("must follow the text onto both lines when the agent rewraps the paragraph", () => {
    const anchor = anchorOn(plan, "cache results for 24h");

    const moved = reanchorPassage(anchor, createDocumentText("# Plan\n\nWe cache results\nfor 24h.\n"));

    expect(moved).toMatchObject({ anchoredText: "cache results\nfor 24h", endLine: 4, outdated: false, startLine: 3 });
  });

  test("must leave the anchor unchanged when only the doc's line endings change", () => {
    const anchor = anchorOn(plan, "cache results for 24h");

    expect(reanchorPassage(anchor, createDocumentText(plan.replaceAll("\n", "\r\n")))).toEqual(anchor);
  });

  test("must mark a whole-fence anchor outdated when the fence is replaced by unrelated code of the same length", () => {
    const code = Array.from({ length: 40 }, (_, index) => `const value${index} = compute(${index});`).join("\n");
    const replacement = Array.from({ length: 40 }, (_, index) => `print("line number ${index} here");`).join("\n");
    const anchor = anchorOn(`# Code\n\n\`\`\`ts\n${code}\n\`\`\`\n`, code);

    const moved = reanchorPassage(anchor, createDocumentText(`# Code\n\n\`\`\`ts\n${replacement}\n\`\`\`\n`));

    expect(moved.outdated).toBe(true);
  });

  test("must mark the anchor outdated and keep its lines when its text is gone", () => {
    const anchor = anchorOn(plan, "cache results for 24h");

    const outdated = reanchorPassage(anchor, createDocumentText("# Plan\n\nNo caching.\n"));

    expect(outdated).toEqual({ ...anchor, endOffset: 16, outdated: true });
  });

  test("must restore an outdated anchor when its text reappears", () => {
    const anchor = { ...anchorOn(plan, "cache results for 24h"), outdated: true };

    expect(reanchorPassage(anchor, createDocumentText(plan)).outdated).toBe(false);
  });

  test("must mark the anchor outdated when its text is empty", () => {
    const anchor = { ...anchorOn(plan, "cache results for 24h"), anchoredText: "" };

    expect(reanchorPassage(anchor, createDocumentText(plan)).outdated).toBe(true);
  });
});

function anchorOn(source: string, quote: string, occurrence = 0): PassageAnchor {
  const documentText = createDocumentText(source);
  let startOffset = documentText.text.indexOf(quote);
  for (let found = 0; found < occurrence; found++) {
    startOffset = documentText.text.indexOf(quote, startOffset + 1);
  }
  const endOffset = startOffset + quote.length;
  return {
    ...linesForRange(documentText, startOffset, endOffset),
    anchoredText: quote,
    document: "docs/plan.md",
    endOffset,
    kind: "passage",
    outdated: false,
    prefix: documentText.text.slice(Math.max(0, startOffset - 32), startOffset),
    quote,
    startOffset,
    suffix: documentText.text.slice(endOffset, endOffset + 32),
  };
}
