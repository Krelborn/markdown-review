import { describe, expect, test, vi } from "vitest";

import { measureBlock } from "./measureBlock";

describe("measureBlock", () => {
  test("must measure a block relative to the view when the block is not in a table", () => {
    const { paragraph, view } = setUpTest({ rowLeft: 140 });

    expect(measureBlock(view, paragraph)).toEqual({
      firstLineMiddle: 42,
      height: 24,
      index: 0,
      left: 40,
      top: 30,
      width: 600,
    });
  });

  test.each([
    { rowLeft: 140, scrolled: "to its start" },
    { rowLeft: 40, scrolled: "sideways" },
  ])(
    "must keep a table row's box to the part its table shows when the row is wider than the table and scrolled $scrolled",
    ({ rowLeft }) => {
      const { row, view } = setUpTest({ rowLeft });

      expect(measureBlock(view, row)).toEqual({
        firstLineMiddle: expect.closeTo(102.8),
        height: 30,
        index: 1,
        left: 40,
        top: 90,
        width: 600,
      });
    }
  );

  test("must find the middle of the block's first line of text when the text starts on the block's first line", () => {
    const { paragraph, view } = setUpTest({ rowLeft: 140 });
    paragraph.append("Retries happen three times.");
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 81, 10, 18));

    expect(measureBlock(view, paragraph).firstLineMiddle).toBe(40);
  });

  test("must pass over text that takes no space when finding the block's first line", () => {
    const { paragraph, view } = setUpTest({ rowLeft: 140 });
    const style = document.createElement("style");
    style.append(".node { fill: blue; }");
    paragraph.append(style, "Retries happen three times.");
    vi.spyOn(Range.prototype, "getBoundingClientRect")
      .mockReturnValueOnce(new DOMRect())
      .mockReturnValue(new DOMRect(140, 86, 10, 16));

    expect(measureBlock(view, paragraph).firstLineMiddle).toBe(44);
  });

  test("must put the middle of the first line half a line below the block's top when its text starts more than a line down", () => {
    const { paragraph, view } = setUpTest({ rowLeft: 140 });
    paragraph.append("const delays = [200, 400];");
    vi.spyOn(paragraph, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 80, 600, 100));
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 120, 10, 20));

    expect(measureBlock(view, paragraph).firstLineMiddle).toBeCloseTo(42.8);
  });

  test("must put the middle of the first line halfway down a block shorter than a line when the block has no text", () => {
    const { paragraph, view } = setUpTest({ rowLeft: 140 });
    vi.spyOn(paragraph, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 80, 600, 2));

    expect(measureBlock(view, paragraph).firstLineMiddle).toBe(31);
  });
});

/**
 * Lays out a view at (100, 50) holding a 600px paragraph and a 600px table whose row is 900px wide and starts at
 * `rowLeft`, as the table's scrolling puts it
 */
function setUpTest({ rowLeft }: { rowLeft: number }) {
  const view = document.createElement("div");
  const paragraph = document.createElement("p");
  paragraph.setAttribute("data-md-block", "0");
  const table = document.createElement("table");
  const row = table.createTBody().insertRow();
  row.setAttribute("data-md-block", "1");
  view.append(paragraph, table);
  vi.spyOn(view, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 50, 800, 1000));
  vi.spyOn(paragraph, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 80, 600, 24));
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue(new DOMRect(140, 120, 600, 80));
  vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(rowLeft, 140, 900, 30));
  return { paragraph, row, view };
}
