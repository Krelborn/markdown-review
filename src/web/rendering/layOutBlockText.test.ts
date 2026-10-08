import { describe, expect, test } from "vitest";

import { layOutBlockText } from "./layOutBlockText";

describe("layOutBlockText", () => {
  test("must read every text node in order when the block has inline markup", () => {
    const block = createBlock("<p>Plain <em>emphasised</em> and <code>code</code></p>");

    expect(layOutBlockText(block).text).toBe("Plain emphasised and code");
  });

  test("must separate the cells with tabs and skip the whitespace between them when the block is a table row", () => {
    const block = createBlock("<table><tbody><tr>\n<td>1</td>\n<td><code>2</code></td>\n</tr></tbody></table>", "tr");

    expect(layOutBlockText(block).text).toBe("1\t2");
  });

  test("must skip text inside elements marked data-md-ignore when the app adds its own controls to a block", () => {
    const block = createBlock('<p>Before <span data-md-ignore="">3</span>after</p>');

    expect(layOutBlockText(block).text).toBe("Before after");
  });

  test("must record where each text node starts in the block's text when the block has several text nodes", () => {
    const block = createBlock("<p>ab<em>cd</em>ef</p>");

    const { segments } = layOutBlockText(block);

    expect(segments.map(({ node, offset }) => [node.data, offset])).toEqual([
      ["ab", 0],
      ["cd", 2],
      ["ef", 4],
    ]);
  });
});

function createBlock(html: string, selector = "p"): Element {
  document.body.innerHTML = html;
  const block = document.body.querySelector(selector);
  if (block === null) {
    throw new Error(`The test HTML has no ${selector} element`);
  }
  return block;
}
