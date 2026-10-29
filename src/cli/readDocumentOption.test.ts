import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { CliError } from "./CliError";
import { readDocumentOption } from "./readDocumentOption";

let directory: string | undefined;

async function setUpRoot(): Promise<string> {
  directory = await mkdtemp(path.join(tmpdir(), "read-document-option-"));
  const root = await realpath(directory);
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  return root;
}

afterEach(async () => {
  if (directory !== undefined) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

describe("readDocumentOption", () => {
  test("must return the repo-relative path when the doc exists", async () => {
    const root = await setUpRoot();

    await expect(readDocumentOption(root, root, "docs/plan.md")).resolves.toBe("docs/plan.md");
  });

  test("must throw a CliError saying the doc does not exist when the file is missing", async () => {
    const root = await setUpRoot();

    const result = readDocumentOption(root, root, "docs/nope.md");

    await expect(result).rejects.toThrow(CliError);
    await expect(result).rejects.toThrow("docs/nope.md does not exist");
  });
});
