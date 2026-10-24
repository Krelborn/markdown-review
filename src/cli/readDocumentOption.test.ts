import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { CliError } from "./CliError";
import { readDocumentOption } from "./readDocumentOption";

describe("readDocumentOption", () => {
  let root: string;
  let outside: string;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(path.join(os.tmpdir(), "document-option-root-")));
    outside = await realpath(await mkdtemp(path.join(os.tmpdir(), "document-option-outside-")));
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
    await writeFile(path.join(outside, "other.md"), "# Other\n");
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
    await rm(outside, { force: true, recursive: true });
  });

  test("must return null when the option was not given", async () => {
    await expect(readDocumentOption(root, root, undefined)).resolves.toBeNull();
  });

  test("must return the repo-relative path when the path is relative to the working directory", async () => {
    await expect(readDocumentOption(root, path.join(root, "docs"), "plan.md")).resolves.toBe("docs/plan.md");
  });

  test("must return the path of the target when the path is a symlink", async () => {
    await symlink(path.join(root, "docs", "plan.md"), path.join(root, "link.md"));

    await expect(readDocumentOption(root, root, "link.md")).resolves.toBe("docs/plan.md");
  });

  test("must throw a CliError when the file is missing", async () => {
    await expect(readDocumentOption(root, root, "docs/nope.md")).rejects.toThrow(
      new CliError(
        "docs/nope.md is not a file",
        "Check the path and run the command again with `--document <path>`, or without `--document`."
      )
    );
  });

  test("must throw a CliError when the path is a directory", async () => {
    await expect(readDocumentOption(root, root, "docs")).rejects.toThrow(CliError);
  });

  test("must throw a CliError when the file is outside the repository", async () => {
    await expect(readDocumentOption(root, root, path.join(outside, "other.md"))).rejects.toThrow(CliError);
  });
});
