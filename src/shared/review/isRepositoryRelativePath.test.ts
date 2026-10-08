import { describe, expect, test } from "vitest";

import { isRepositoryRelativePath } from "./isRepositoryRelativePath";

describe("isRepositoryRelativePath", () => {
  test.each([
    { value: "README.md", expected: true },
    { value: "docs/plans/plan.md", expected: true },
    { value: "", expected: false },
    { value: "/etc/passwd", expected: false },
    { value: "../outside.md", expected: false },
    { value: "docs/../../outside.md", expected: false },
    { value: "docs//plan.md", expected: false },
    { value: "./plan.md", expected: false },
    { value: "docs\\plan.md", expected: false },
  ])("must return $expected when the path is '$value'", ({ value, expected }) => {
    expect(isRepositoryRelativePath(value)).toBe(expected);
  });
});
