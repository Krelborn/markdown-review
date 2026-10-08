import { describe, expect, test } from "vitest";

import { hashSource } from "./hashSource";

describe("hashSource", () => {
  test("must return the SHA-256 as lowercase hex when given a source", () => {
    expect(hashSource("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
