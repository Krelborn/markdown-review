import { describe, expect, test } from "vitest";

import { findOverlaps } from "./findOverlaps";

describe("findOverlaps", () => {
  test.each<{ condition: string; expected: string[]; spans: [number, number][] }>([
    {
      condition: "two ranges share text",
      expected: ["ef"],
      spans: [
        [2, 6],
        [4, 8],
      ],
    },
    {
      condition: "two ranges are apart",
      expected: [],
      spans: [
        [0, 3],
        [5, 8],
      ],
    },
    {
      condition: "two ranges only touch",
      expected: [],
      spans: [
        [0, 3],
        [3, 6],
      ],
    },
    {
      condition: "one range holds another",
      expected: ["de"],
      spans: [
        [0, 10],
        [3, 5],
      ],
    },
    {
      condition: "three ranges overlap",
      expected: ["cd", "d", "def"],
      spans: [
        [0, 4],
        [2, 6],
        [3, 8],
      ],
    },
  ])("must return the text each pair shares when $condition", ({ expected, spans }) => {
    const text = document.createTextNode("abcdefghij");
    document.body.replaceChildren(text);

    const overlaps = findOverlaps(spans.map(([start, end]) => rangeOver(text, start, end)));

    expect(overlaps.map((range) => range.toString())).toEqual(expected);
  });
});

function rangeOver(node: Text, start: number, end: number): Range {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}
