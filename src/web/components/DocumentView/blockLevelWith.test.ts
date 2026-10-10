import { describe, expect, test } from "vitest";

import type { BlockBox } from "./BlockBox";
import { blockLevelWith } from "./blockLevelWith";

/**
 * A 30px block at 0, a 20px block at 50, an empty block at 80 and a 40px block at 90
 */
const boxes = [box(0, 0, 30), box(1, 50, 20), box(2, 80, 0), box(3, 90, 40)];

describe("blockLevelWith", () => {
  test.each([
    { expected: 0, top: 10, where: "inside the first block" },
    { expected: 0, top: -20, where: "above the first block" },
    { expected: 0, top: 39, where: "in the upper half of the gap below the first block" },
    { expected: 1, top: 41, where: "in the lower half of the gap above the second block" },
    {
      expected: 1,
      top: 75,
      where: "in the upper half of the gap below the second block, which an empty block sits in",
    },
    { expected: 3, top: 85, where: "in the lower half of that gap" },
    { expected: 3, top: 500, where: "below the last block" },
  ])("must pick block $expected when the offset is $where", ({ expected, top }) => {
    expect(blockLevelWith(boxes, top)?.index).toBe(expected);
  });

  test.each([
    { case: "the doc has no blocks", shown: [] },
    { case: "every block is empty", shown: [box(0, 0, 0), box(1, 10, 0)] },
  ])("must pick no block when $case", ({ shown }) => {
    expect(blockLevelWith(shown, 10)).toBeNull();
  });
});

function box(index: number, top: number, height: number): BlockBox {
  return { firstLineMiddle: top, height, index, left: 0, top, width: 600 };
}
