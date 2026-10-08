import { describe, expect, test } from "vitest";

import { isFileNotFound } from "./isFileNotFound";

describe("isFileNotFound", () => {
  test("must return true when the error has the code ENOENT", () => {
    const error = Object.assign(new Error("no such file"), { code: "ENOENT" });

    expect(isFileNotFound(error)).toBe(true);
  });

  test("must return false when the error has another code", () => {
    const error = Object.assign(new Error("is a directory"), { code: "EISDIR" });

    expect(isFileNotFound(error)).toBe(false);
  });

  test("must return false when the error has no code", () => {
    expect(isFileNotFound(new Error("boom"))).toBe(false);
  });

  test("must return false when the value is not an error", () => {
    expect(isFileNotFound({ code: "ENOENT" })).toBe(false);
  });
});
