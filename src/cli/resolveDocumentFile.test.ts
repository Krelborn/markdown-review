import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { CliError } from "./CliError";
import { readDocumentOption } from "./readDocumentOption";
import { resolveDocumentFile } from "./resolveDocumentFile";

const getDirectory = setUpTemporaryDirectory();

describe("resolveDocumentFile", () => {
  test("must return the real path when the file exists", async () => {
    const directory = await realpath(getDirectory());
    await writeFile(path.join(directory, "doc.md"), "# Doc\n");

    expect(await resolveDocumentFile(directory, "doc.md")).toBe(path.join(directory, "doc.md"));
  });

  test("must refuse the path when the file is missing", async () => {
    const directory = await realpath(getDirectory());

    await expect(resolveDocumentFile(directory, "nope.md")).rejects.toThrow(CliError);
  });

  test("must refuse the path when it is a directory", async () => {
    const directory = await realpath(getDirectory());
    await mkdir(path.join(directory, "docs"));

    await expect(resolveDocumentFile(directory, "docs")).rejects.toThrow(CliError);
  });

  test("must return the target's real path when the path is a symlink", async () => {
    const directory = await realpath(getDirectory());
    await writeFile(path.join(directory, "doc.md"), "# Doc\n");
    await symlink(path.join(directory, "doc.md"), path.join(directory, "link.md"));

    expect(await resolveDocumentFile(directory, "link.md")).toBe(path.join(directory, "doc.md"));
  });
});

describe("readDocumentOption", () => {
  test("must return null when the option was not given", async () => {
    expect(await readDocumentOption("/root", "/root", undefined)).toBeNull();
  });

  test("must return the repo-relative path when the doc exists", async () => {
    const root = await realpath(getDirectory());
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");

    expect(await readDocumentOption(root, path.join(root, "docs"), "plan.md")).toBe("docs/plan.md");
  });

  test("must refuse the doc when it is missing", async () => {
    const root = await realpath(getDirectory());

    await expect(readDocumentOption(root, root, "nope.md")).rejects.toThrow(CliError);
  });

  test("must refuse the doc when it is outside the root", async () => {
    const directory = await realpath(getDirectory());
    const root = path.join(directory, "repo");
    await mkdir(root);
    await writeFile(path.join(directory, "outside.md"), "# Outside\n");

    await expect(readDocumentOption(root, root, "../outside.md")).rejects.toThrow(CliError);
  });
});
