import { describe, expect, test, vi } from "vitest";

import { measureBlock } from "./measureBlock";

describe("measureBlock", () => {
  test("must measure a block relative to the view when the block is not in a table", () => {
    const { paragraph, view } = setUpTest({ rowLeft: 140 });

    expect(measureBlock(view, paragraph)).toEqual({ height: 24, index: 0, left: 40, top: 30, width: 600 });
  });

  test.each([
    { rowLeft: 140, scrolled: "to its start" },
    { rowLeft: 40, scrolled: "sideways" },
  ])(
    "must keep a table row's box to the part its table shows when the row is wider than the table and scrolled $scrolled",
    ({ rowLeft }) => {
      const { row, view } = setUpTest({ rowLeft });

      expect(measureBlock(view, row)).toEqual({ height: 30, index: 1, left: 40, top: 90, width: 600 });
    }
  );
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
