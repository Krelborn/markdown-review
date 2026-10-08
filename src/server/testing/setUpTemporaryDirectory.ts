import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

/**
 * Registers hooks that give each test a fresh temporary directory and delete it afterwards
 *
 * @returns a function that returns the directory of the running test
 */
export function setUpTemporaryDirectory(): () => string {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "markdown-review-"));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  return () => directory;
}
