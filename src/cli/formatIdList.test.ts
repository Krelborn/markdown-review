import { describe, expect, test } from "vitest";

import { formatIdList } from "./formatIdList";

describe("formatIdList", () => {
  test.each([
    { ids: [14], expected: "#14" },
    { ids: [14, 15], expected: "#14 and #15" },
    { ids: [14, 15, 16], expected: "#14, #15 and #16" },
  ])("must return '$expected' when the IDs are $ids", ({ ids, expected }) => {
    expect(formatIdList(ids)).toBe(expected);
  });
});
