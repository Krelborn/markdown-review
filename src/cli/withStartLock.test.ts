import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { withStartLock } from "./withStartLock";

const getDirectory = setUpTemporaryDirectory();

describe("withStartLock", () => {
  test("must run one task at a time and remove the lock afterwards when two commands start together", async () => {
    const root = await setUpTest();
    let running = 0;
    let mostAtOnce = 0;
    const task = async (): Promise<void> => {
      running += 1;
      mostAtOnce = Math.max(mostAtOnce, running);
      await new Promise((resolve) => setTimeout(resolve, 50));
      running -= 1;
    };

    await Promise.all([withStartLock(root, task), withStartLock(root, task)]);

    expect(mostAtOnce).toBe(1);
    await expect(stat(lockPath(root))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("must take over the lock when the process that held it has exited", async () => {
    const root = await setUpTest();
    await writeFile(lockPath(root), "999999");

    const result = await withStartLock(root, async () => readFile(lockPath(root), "utf8"));

    expect(result).toBe(String(process.pid));
  });
});

async function setUpTest(): Promise<string> {
  const root = getDirectory();
  await mkdir(path.join(root, ".markdown-review"));
  return root;
}

function lockPath(root: string): string {
  return path.join(root, ".markdown-review", "server.lock");
}
