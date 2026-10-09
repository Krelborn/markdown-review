import { describe, expect, test } from "vitest";

import { formatMessageTime } from "./formatMessageTime";

const now = new Date("2026-10-08T16:00:00.000Z");

describe("formatMessageTime", () => {
  test.each([
    { at: "2026-10-08T10:42:00.000Z", condition: "it was sent today", expected: "10:42" },
    { at: "2026-10-07T23:59:00.000Z", condition: "it was sent yesterday", expected: "7 Oct" },
    { at: "2025-10-08T10:42:00.000Z", condition: "it was sent on this day last year", expected: "8 Oct" },
  ])("must show $expected when $condition", ({ at, expected }) => {
    expect(formatMessageTime(at, now, "en-GB")).toBe(expected);
  });
});
