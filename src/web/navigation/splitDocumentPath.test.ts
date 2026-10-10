import { describe, expect, test } from "vitest";

import { splitDocumentPath } from "./splitDocumentPath";

describe("splitDocumentPath", () => {
  test.each([
    { path: "docs/notes/plan.md", fileName: "plan.md", folder: "docs/notes" },
    { path: "docs/plan.md", fileName: "plan.md", folder: "docs" },
    { path: "README.md", fileName: "README.md", folder: "" },
  ])("must split '$path' into '$fileName' in '$folder'", ({ fileName, folder, path }) => {
    expect(splitDocumentPath(path)).toEqual({ fileName, folder });
  });
});
