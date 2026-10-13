import { describe, expect, test } from "vitest";

import { placeThreadBars } from "./placeThreadBars";

describe("placeThreadBars", () => {
  test("must put every bar in the lane nearest the prose when no two comments share a block", () => {
    expect(
      placeThreadBars([
        { firstBlock: 0, lastBlock: 2, length: 60, threadId: 1 },
        { firstBlock: 3, lastBlock: 5, length: 40, threadId: 2 },
      ])
    ).toEqual([
      { firstBlock: 3, lane: 1, lastBlock: 5, length: 40, threadId: 2 },
      { firstBlock: 0, lane: 1, lastBlock: 2, length: 60, threadId: 1 },
    ]);
  });

  test("must put the shorter comment's bar nearest the prose when one comment's blocks hold another's", () => {
    expect(
      placeThreadBars([
        { firstBlock: 0, lastBlock: 9, length: 400, threadId: 1 },
        { firstBlock: 4, lastBlock: 6, length: 50, threadId: 2 },
      ]).map(({ lane, threadId }) => ({ lane, threadId }))
    ).toEqual([
      { lane: 1, threadId: 2 },
      { lane: 2, threadId: 1 },
    ]);
  });

  test("must put every bar after the first in the outer lane when three comments share a block", () => {
    expect(
      placeThreadBars([
        { firstBlock: 0, lastBlock: 4, length: 100, threadId: 1 },
        { firstBlock: 2, lastBlock: 6, length: 90, threadId: 2 },
        { firstBlock: 3, lastBlock: 3, length: 20, threadId: 3 },
      ]).map(({ lane, threadId }) => ({ lane, threadId }))
    ).toEqual([
      { lane: 1, threadId: 3 },
      { lane: 2, threadId: 2 },
      { lane: 2, threadId: 1 },
    ]);
  });
});
