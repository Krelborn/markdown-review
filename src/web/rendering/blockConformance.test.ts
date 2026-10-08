import { beforeAll, describe, expect, test } from "vitest";

import { parseBlocks } from "../../shared/markdown/parseBlocks";

import { layOutBlockText } from "./layOutBlockText";
import { renderDocument } from "./renderDocument";
import conformanceCorpus from "./testing/conformanceCorpus.md?raw";

const blocks = parseBlocks(conformanceCorpus).map((block, index) => ({ ...block, index }));

describe("rendered blocks", () => {
  beforeAll(async () => {
    document.body.innerHTML = await renderDocument(conformanceCorpus, "docs/corpus.md");
  });

  test.each(blocks)("must tag exactly one element with block $index and its lines", ({ index, startLine, endLine }) => {
    const elements = document.querySelectorAll(`[data-md-block="${index}"]`);

    expect(elements.length).toBe(1);
    expect(elements[0]?.getAttribute("data-md-start")).toBe(String(startLine));
    expect(elements[0]?.getAttribute("data-md-end")).toBe(String(endLine));
  });

  test.each(blocks.filter((block) => !block.wholeBlockOnly))(
    "must read the canonical text of block $index from the rendered page",
    ({ index, text }) => {
      const element = document.querySelector(`[data-md-block="${index}"]`);

      expect(element === null ? null : layOutBlockText(element).text).toBe(text);
    }
  );
});
