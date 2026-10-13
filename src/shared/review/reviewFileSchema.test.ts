import { describe, expect, test } from "vitest";

import type { ReviewFile } from "./reviewFileSchema";
import { reviewFileSchema } from "./reviewFileSchema";
import { buildPassageAnchor, buildRound, buildThread } from "./testing/reviewBuilders";

describe("reviewFileSchema", () => {
  test("must accept the file when every thread is on the whole review", () => {
    const file: ReviewFile = { round: buildRound(), threads: [buildThread()], version: 2 };

    expect(reviewFileSchema.safeParse(file).success).toBe(true);
  });

  test("must reject the file when a thread is anchored to a doc", () => {
    const file: ReviewFile = {
      round: null,
      threads: [buildThread({ anchor: buildPassageAnchor() })],
      version: 2,
    };

    expect(reviewFileSchema.safeParse(file).success).toBe(false);
  });
});
