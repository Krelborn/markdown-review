import { describe, expect, test } from "vitest";

import { autoScrollStep } from "./autoScrollStep";

const visible = { bottom: 600, top: 100 };

describe("autoScrollStep", () => {
  test.each([
    { condition: "the pointer is away from both edges", expected: 0, pointerY: 350 },
    { condition: "the pointer is just outside the top edge's zone", expected: 0, pointerY: 148 },
    { condition: "the pointer is halfway into the top edge's zone", expected: -10, pointerY: 124 },
    { condition: "the pointer is above the box", expected: -20, pointerY: 40 },
    { condition: "the pointer is a quarter of the way into the bottom edge's zone", expected: 5, pointerY: 564 },
    { condition: "the pointer is below the box", expected: 20, pointerY: 700 },
  ])("must scroll by $expected when $condition", ({ expected, pointerY }) => {
    expect(autoScrollStep(pointerY, visible)).toBe(expected);
  });
});
