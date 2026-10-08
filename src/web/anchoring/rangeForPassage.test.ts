import { describe, expect, test } from "vitest";

import { parseBlocks } from "../../shared/markdown/parseBlocks";
import conformanceCorpus from "../rendering/testing/conformanceCorpus.md?raw";
import { mountDocument } from "../testing/mountDocument";

import { offsetInDocument } from "./offsetInDocument";
import { rangeForPassage } from "./rangeForPassage";

const source =
  "# Plan\n\nWe cache results for **24h** today.\n\nRetries happen three times.\n\n<div>\nRaw HTML\n</div>\n";

const corpusBlocks = parseBlocks(conformanceCorpus)
  .map((block, index) => ({ ...block, index }))
  .filter((block) => !block.wholeBlockOnly);

describe("rangeForPassage", () => {
  test("must cover exactly the passage's text when the passage crosses inline markup", async () => {
    const { container, documentText } = await mountDocument(source);
    const start = documentText.text.indexOf("cache");

    const range = rangeForPassage(container, documentText, start, start + "cache results for 24h".length);

    expect(range?.toString()).toBe("cache results for 24h");
  });

  test("must run from one block into the next when the passage spans two paragraphs", async () => {
    const { container, documentText } = await mountDocument(source);
    const start = documentText.text.indexOf("24h");

    const range = rangeForPassage(container, documentText, start, start + "24h today.\nRetries".length);

    expect(range?.toString()).toBe("24h today.\nRetries");
  });

  test("must cover the whole block when the passage is in a block that takes whole-block comments only", async () => {
    const { container, documentText } = await mountDocument(source);
    const start = documentText.text.indexOf("<div>");

    const range = rangeForPassage(container, documentText, start, start + 5);

    expect(range?.toString()).toBe(container.querySelector('[data-md-block="3"]')?.textContent);
  });

  test.each(corpusBlocks)(
    "must map block $index back to the same offsets when it is found in the page",
    async ({ index }) => {
      const { container, documentText } = await mountDocument(conformanceCorpus);
      const start = documentText.blockStartOffsets[index] ?? 0;
      const end = start + (documentText.blocks[index]?.text.length ?? 0);

      const range = rangeForPassage(container, documentText, start, end);

      const startPoint = { node: range?.startContainer as Node, offset: range?.startOffset ?? 0 };
      const endPoint = { node: range?.endContainer as Node, offset: range?.endOffset ?? 0 };
      expect([
        offsetInDocument(container, documentText, startPoint, "start"),
        offsetInDocument(container, documentText, endPoint, "end"),
      ]).toEqual([start, end]);
    }
  );
});
