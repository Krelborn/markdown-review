import { describe, expect, test } from "vitest";

import type { ReviewFile } from "./reviewFileSchema";
import { reviewFileSchema } from "./reviewFileSchema";
import { buildPassageAnchor, buildThread, testTime } from "./testing/reviewBuilders";

describe("reviewFileSchema", () => {
  test("must accept the file when every thread is on the whole review", () => {
    const file: ReviewFile = { approvedAt: null, requestedAt: testTime, threads: [buildThread()], version: 1 };

    expect(reviewFileSchema.safeParse(file).success).toBe(true);
  });

  test("must reject the file when a thread is anchored to a doc", () => {
    const file: ReviewFile = {
      approvedAt: null,
      requestedAt: null,
      threads: [buildThread({ anchor: buildPassageAnchor() })],
      version: 1,
    };

    expect(reviewFileSchema.safeParse(file).success).toBe(false);
  });
});
