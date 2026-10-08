import { createHighlighter } from "shiki";
import { beforeAll, describe, expect, test } from "vitest";

import { createMarkdownIt } from "../../shared/markdown/createMarkdownIt";
import { parseBlocks } from "../../shared/markdown/parseBlocks";

import { layOutBlockText } from "./layOutBlockText";
import { sanitizeRenderedHtml } from "./sanitizeRenderedHtml";
import conformanceCorpus from "./testing/conformanceCorpus.md?raw";

const blocks = parseBlocks(conformanceCorpus).map((block, index) => ({ ...block, index }));

describe("rendered blocks", () => {
  beforeAll(async () => {
    const highlighter = await createHighlighter({ langs: ["ts"], themes: ["github-light"] });
    const markdown = createMarkdownIt({
      highlight: (code, language) =>
        language === "ts" ? highlighter.codeToHtml(code, { lang: language, theme: "github-light" }) : null,
    });
    document.body.innerHTML = sanitizeRenderedHtml(markdown.render(conformanceCorpus));
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
