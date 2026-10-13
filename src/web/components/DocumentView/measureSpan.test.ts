import { describe, expect, test, vi } from "vitest";

import { measureSpan } from "./measureSpan";

describe("measureSpan", () => {
  test("must measure the block as the + does when the span is one block", () => {
    const { content, view } = setUpTest();

    expect(measureSpan(view, content, { firstBlock: 0, lastBlock: 0 })).toMatchObject({
      height: 24,
      left: 40,
      top: 30,
      width: 600,
    });
  });

  test("must reach across the prose from the first block's top to the last block's bottom when the span holds several blocks", () => {
    const { content, view } = setUpTest();

    expect(measureSpan(view, content, { firstBlock: 0, lastBlock: 3 })).toEqual({
      height: 190,
      left: 40,
      top: 30,
      width: 600,
    });
  });

  test("must reach to the widest block's right edge when a block of the span reaches past the prose", () => {
    const { content, view } = setUpTest({ codeWidth: 800 });

    expect(measureSpan(view, content, { firstBlock: 3, lastBlock: 4 })).toEqual({
      height: 74,
      left: 40,
      top: 160,
      width: 800,
    });
  });

  test("must cover the part the table shows when every block of the span is a row of one table", () => {
    const { content, view } = setUpTest();

    expect(measureSpan(view, content, { firstBlock: 1, lastBlock: 2 })).toEqual({
      height: 60,
      left: 40,
      top: 70,
      width: 300,
    });
  });

  test("must return null when the doc has no such block", () => {
    const { content, view } = setUpTest();

    expect(measureSpan(view, content, { firstBlock: 3, lastBlock: 6 })).toBeNull();
  });
});

/**
 * Lays out a view at (100, 50) holding 600px of prose from 140px across: a paragraph, a 300px table of two rows that are
 * 500px wide and scrolled to their start, a paragraph, and a code block `codeWidth` wide
 */
function setUpTest({ codeWidth = 600 }: { codeWidth?: number } = {}) {
  const view = document.createElement("div");
  const content = document.createElement("article");
  const paragraph = document.createElement("p");
  paragraph.setAttribute("data-md-block", "0");
  const table = document.createElement("table");
  const body = table.createTBody();
  const rows = [body.insertRow(), body.insertRow()];
  rows.forEach((row, index) => row.setAttribute("data-md-block", `${index + 1}`));
  const after = document.createElement("p");
  after.setAttribute("data-md-block", "3");
  const code = document.createElement("div");
  code.setAttribute("data-md-block", "4");
  content.append(paragraph, table, after, code);
  view.append(content);
  vi.spyOn(view, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 50, 800, 1000));
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 60, 600, 400));
  vi.spyOn(paragraph, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 80, 600, 24));
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 120, 300, 60));
  rows.forEach((row, index) =>
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 120 + 30 * index, 500, 30))
  );
  vi.spyOn(after, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 210, 600, 60));
  vi.spyOn(code, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 270, codeWidth, 14));
  return { content, view };
}
