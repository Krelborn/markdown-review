import { describe, expect, test } from "vitest";

import { preferredPort } from "./preferredPort";

describe("preferredPort", () => {
  test("must return the same dynamic-range port when asked twice for the same root", () => {
    const port = preferredPort("/Users/someone/repo");

    expect(preferredPort("/Users/someone/repo")).toBe(port);
    expect(port).toBeGreaterThanOrEqual(49152);
    expect(port).toBeLessThanOrEqual(65535);
  });

  test("must return different ports when the roots differ", () => {
    expect(preferredPort("/Users/someone/repo")).not.toBe(preferredPort("/Users/someone/other"));
  });
});
