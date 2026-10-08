import path from "node:path";
import { describe, expect, test } from "vitest";

import { CliError } from "./CliError";
import { toRepositoryPath } from "./toRepositoryPath";

const root = path.join(path.sep, "work", "repo");

describe("toRepositoryPath", () => {
  test("must return a POSIX path relative to the root when the path is inside the root", () => {
    expect(toRepositoryPath(root, path.join(root, "docs", "plan.md"))).toBe("docs/plan.md");
  });

  test.each([
    { condition: "the path is outside the root", absolutePath: path.join(path.sep, "work", "other.md") },
    { condition: "the path is the root itself", absolutePath: root },
  ])("must refuse the path when $condition", ({ absolutePath }) => {
    expect(() => toRepositoryPath(root, absolutePath)).toThrow(CliError);
  });
});
