import { describe, expect, test } from "vitest";

import { CliError } from "./CliError";
import { readThreadIdArgument } from "./readThreadIdArgument";

describe("readThreadIdArgument", () => {
  test.each([
    { value: "14", expected: 14 },
    { value: "#14", expected: 14 },
  ])("must read the ID when the argument is '$value'", ({ value, expected }) => {
    expect(readThreadIdArgument(value, "markdown-review resolve <id>")).toBe(expected);
  });

  test.each([{ value: undefined }, { value: "0" }, { value: "fourteen" }])(
    "must refuse the argument when it is $value",
    ({ value }) => {
      expect(() => readThreadIdArgument(value, "markdown-review resolve <id>")).toThrow(CliError);
    }
  );
});
