import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { CliError } from "./CliError";
import { readDocumentOption } from "./readDocumentOption";

const runCommand = promisify(execFile);

const getDirectory = setUpTemporaryDirectory();

const isCaseInsensitive = existsSync(import.meta.filename.toUpperCase());

describe("readDocumentOption", () => {
  test("must return null when the option was not given", async () => {
    const { root } = await setUpRepository();

    expect(await readDocumentOption(root, root, undefined)).toBeNull();
  });

  test("must return the repo-relative path when the path is a file inside the repository", async () => {
    const { root } = await setUpRepository();

    expect(await readDocumentOption(root, path.join(root, "docs"), "plan.md")).toBe("docs/plan.md");
  });

  test("must return the path the symbolic link leads to when the path is a link inside the repository", async () => {
    const { root } = await setUpRepository();
    await symlink(path.join(root, "docs", "plan.md"), path.join(root, "link.md"));

    expect(await readDocumentOption(root, root, "link.md")).toBe("docs/plan.md");
  });

  test("must return the path the link leads to when it is run from a folder of the repository and the link is outside it", async () => {
    const { outside, root } = await setUpRepository();
    await symlink(path.join(root, "docs", "plan.md"), path.join(outside, "link.md"));

    expect(await readDocumentOption(root, path.join(root, "docs"), path.join(outside, "link.md"))).toBe("docs/plan.md");
  });

  test("must refuse the path when a symbolic link leads out of the repository", async () => {
    const { outside, root } = await setUpRepository();
    await symlink(path.join(outside, "secret.md"), path.join(root, "link.md"));

    await expect(readDocumentOption(root, root, "link.md")).rejects.toThrow(CliError);
  });

  test("must refuse the path when the file is outside the repository", async () => {
    const { outside, root } = await setUpRepository();

    await expect(readDocumentOption(root, root, path.join(outside, "secret.md"))).rejects.toThrow(CliError);
  });

  test("must refuse the path when the file is in another repository", async () => {
    const { outside, root } = await setUpRepository();
    await runCommand("git", ["init", "-q"], { cwd: outside });

    await expect(readDocumentOption(root, root, path.join(outside, "secret.md"))).rejects.toThrow(/not at/);
  });

  test.each([{ target: "docs" }, { target: "." }])(
    "must refuse the path and say it is not a file when it is the directory $target",
    async ({ target }) => {
      const { root } = await setUpRepository();

      await expect(readDocumentOption(root, root, target)).rejects.toThrow(`${target} is not a file`);
    }
  );

  test("must return the path as typed when the file is missing", async () => {
    const { root } = await setUpRepository();

    expect(await readDocumentOption(root, root, "docs/gone.md")).toBe("docs/gone.md");
  });

  test("must return the path the folder link leads to when the file is missing beneath a link to a folder", async () => {
    const { root } = await setUpRepository();
    await symlink(path.join(root, "docs"), path.join(root, "linked"));

    expect(await readDocumentOption(root, root, "linked/gone.md")).toBe("docs/gone.md");
  });

  test("must refuse a missing path when it is outside the repository", async () => {
    const { outside, root } = await setUpRepository();

    await expect(readDocumentOption(root, root, path.join(outside, "gone.md"))).rejects.toThrow(CliError);
  });

  test("must refuse a missing path when a link to a folder leads out of the repository", async () => {
    const { outside, root } = await setUpRepository();
    await symlink(outside, path.join(root, "linked"));

    await expect(readDocumentOption(root, root, "linked/gone.md")).rejects.toThrow(CliError);
  });

  test.skipIf(!isCaseInsensitive)(
    "must return the path as the store records it when the case of the path differs",
    async () => {
      const { root } = await setUpRepository();

      expect(await readDocumentOption(root, root, "DOCS/Plan.MD")).toBe("docs/plan.md");
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
