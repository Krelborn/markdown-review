import { describe, expect, test } from "vitest";

import { hashSource } from "./hashSource";

describe("hashSource", () => {
  test("must return the SHA-256 of the anchoring version and the source as lowercase hex when given a source", () => {
    expect(hashSource("abc")).toBe("29d02cb1417999ed61b6b17b7ae214987dd6657439f2c35b36528e01830e6aa6");
  });
});
