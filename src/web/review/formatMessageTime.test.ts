import { describe, expect, test } from "vitest";

import { formatMessageTime } from "./formatMessageTime";

const now = new Date("2026-10-08T16:00:00.000Z");

describe("formatMessageTime", () => {
  test.each([
    { at: "2026-10-08T10:42:00.000Z", condition: "it was sent today", expected: "10:42", locales: "en-GB" },
    {
      at: "2026-10-08T09:05:00.000Z",
      condition: "it was sent this morning by a 24-hour clock",
      expected: "09:05",
      locales: "en-GB",
    },
    {
      at: "2026-10-08T09:05:00.000Z",
      condition: "it was sent this morning by a 12-hour clock",
      expected: "9:05 AM",
      locales: "en-US",
    },
    { at: "2026-10-07T23:59:00.000Z", condition: "it was sent yesterday", expected: "7 Oct", locales: "en-GB" },
    {
      at: "2025-10-08T10:42:00.000Z",
      condition: "it was sent on this day last year",
      expected: "8 Oct",
      locales: "en-GB",
    },
  ])("must show $expected when $condition", ({ at, expected, locales }) => {
    expect(formatMessageTime(at, now, locales)).toBe(expected);
  });
});
