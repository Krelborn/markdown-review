import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

import type { DocumentList } from "../shared/api/apiResponseSchemas";
import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { CliError } from "./CliError";
import { readDocumentOption } from "./readDocumentOption";

const runCommand = promisify(execFile);

const getDirectory = setUpTemporaryDirectory();

const isCaseInsensitive = existsSync(import.meta.filename.toUpperCase());

describe("readDocumentOption", () => {
  test("must return null when the option was not given", async () => {
    const { root } = await setUpRepository();

    expect(await readDocumentOption(root, root, undefined, clientWithThreadsOn())).toBeNull();
  });

  test("must return the repo-relative path when the path is a file inside the repository", async () => {
    const { root } = await setUpRepository();

    expect(await readDocumentOption(root, path.join(root, "docs"), "plan.md", clientWithThreadsOn())).toBe(
      "docs/plan.md"
    );
  });

  test("must return the path the symbolic link leads to when the path is a link inside the repository", async () => {
    const { root } = await setUpRepository();
    await symlink(path.join(root, "docs", "plan.md"), path.join(root, "link.md"));

    expect(await readDocumentOption(root, root, "link.md", clientWithThreadsOn())).toBe("docs/plan.md");
  });

  test("must refuse the path when a symbolic link leads out of the repository", async () => {
    const { outside, root } = await setUpRepository();
    await symlink(path.join(outside, "secret.md"), path.join(root, "link.md"));

    await expect(readDocumentOption(root, root, "link.md", clientWithThreadsOn())).rejects.toThrow(CliError);
  });

  test("must refuse the path when the file is outside the repository", async () => {
    const { outside, root } = await setUpRepository();

    await expect(
      readDocumentOption(root, root, path.join(outside, "secret.md"), clientWithThreadsOn())
    ).rejects.toThrow(CliError);
  });

  test("must refuse the path when the file is in another repository", async () => {
    const { outside, root } = await setUpRepository();
    await runCommand("git", ["init", "-q"], { cwd: outside });

    await expect(
      readDocumentOption(root, root, path.join(outside, "secret.md"), clientWithThreadsOn())
    ).rejects.toThrow(/not at/);
  });

  test("must refuse the path and say the doc does not exist when it is missing and has no threads", async () => {
    const { root } = await setUpRepository();

    const failure = await readDocumentOption(root, root, "docs/nope.md", clientWithThreadsOn("docs/other.md")).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(CliError);
    expect(failure).toMatchObject({ message: expect.stringContaining("docs/nope.md does not exist") });
  });

  test("must return the path when the file is missing but the review still has threads on it", async () => {
    const { root } = await setUpRepository();

    expect(await readDocumentOption(root, root, "docs/gone.md", clientWithThreadsOn("docs/gone.md"))).toBe(
      "docs/gone.md"
    );
  });

  test("must refuse a missing path outside the repository even when the review has threads on a doc of that name", async () => {
    const { outside, root } = await setUpRepository();

    await expect(
      readDocumentOption(root, root, path.join(outside, "gone.md"), clientWithThreadsOn("gone.md"))
    ).rejects.toThrow(CliError);
  });

  test.skipIf(!isCaseInsensitive)(
    "must return the path as the store records it when the case of the path differs",
    async () => {
      const { root } = await setUpRepository();

      expect(await readDocumentOption(root, root, "DOCS/Plan.MD", clientWithThreadsOn())).toBe("docs/plan.md");
    }
  );
});

async function setUpRepository(): Promise<{ outside: string; root: string }> {
  const base = await realpath(getDirectory());
  const root = path.join(base, "repo");
  const outside = path.join(base, "outside");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  await writeFile(path.join(outside, "secret.md"), "# Secret\n");
  await runCommand("git", ["init", "-q"], { cwd: root });
  return { outside, root };
}

function clientWithThreadsOn(...documents: string[]): { documents: () => Promise<DocumentList> } {
  return {
    documents: () =>
      Promise.resolve({
        documents: documents.map((document) => ({ document, draftCount: 0, openCount: 1 })),
        problems: [],
        recent: [],
      }),
  };
}
