import { describe, expect, test } from "vitest";

import { findAvailableUpdate } from "./findAvailableUpdate";

describe("findAvailableUpdate", () => {
  test.each([
    {
      condition: "latest is newer",
      current: "0.3.0",
      distTags: { latest: "0.4.0" },
      expected: { distTag: "latest", version: "0.4.0" },
    },
    { condition: "latest is the same", current: "0.3.0", distTags: { latest: "0.3.0" }, expected: null },
    { condition: "latest is older", current: "0.4.0", distTags: { latest: "0.3.0" }, expected: null },
    {
      condition: "only next is newer on a release",
      current: "0.3.0",
      distTags: { latest: "0.3.0", next: "0.4.0-beta.1" },
      expected: null,
    },
    {
      condition: "next is newer on a pre-release",
      current: "0.4.0-beta.1",
      distTags: { latest: "0.3.0", next: "0.4.0-beta.2" },
      expected: { distTag: "next", version: "0.4.0-beta.2" },
    },
    {
      condition: "latest is newer than next on a pre-release",
      current: "0.4.0-beta.1",
      distTags: { latest: "0.4.0", next: "0.4.0-beta.2" },
      expected: { distTag: "latest", version: "0.4.0" },
    },
    { condition: "there are no tags", current: "0.3.0", distTags: {}, expected: null },
    { condition: "latest cannot be read", current: "0.3.0", distTags: { latest: "soon" }, expected: null },
    { condition: "the current version cannot be read", current: "dev", distTags: { latest: "0.4.0" }, expected: null },
  ])("must return $expected.version when $condition", ({ current, distTags, expected }) => {
    expect(findAvailableUpdate(current, distTags)).toEqual(expected);
  });
});
