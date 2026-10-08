import { execFile } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { findRoot } from "./findRoot";

const runCommand = promisify(execFile);

const getDirectory = setUpTemporaryDirectory();

describe("findRoot", () => {
  test("must return the repository root when the directory is deep inside a git repository", async () => {
    const root = await realpath(getDirectory());
    await runCommand("git", ["init", "-q"], { cwd: root });
    await mkdir(path.join(root, "docs", "plans"), { recursive: true });

    expect(await findRoot(path.join(root, "docs", "plans"))).toBe(root);
  });

  test("must return the directory itself when it is not in a git repository", async () => {
    const directory = await realpath(getDirectory());

    expect(await findRoot(directory)).toBe(directory);
  });

  test("must return the given directory when the directory is not in a git repository and another is given", async () => {
    const directory = await realpath(getDirectory());
    await mkdir(path.join(directory, "docs"));

    expect(await findRoot(path.join(directory, "docs"), directory)).toBe(directory);
  });
});
