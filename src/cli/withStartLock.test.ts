import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { withStartLock } from "./withStartLock";

const removalDelays = vi.hoisted((): number[] => []);

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    rm: async (...args: Parameters<typeof original.rm>) => {
      await new Promise((resolve) => setTimeout(resolve, removalDelays.shift() ?? 0));
      return original.rm(...args);
    },
  };
});

const getDirectory = setUpTemporaryDirectory();

describe("withStartLock", () => {
  test("must run one task at a time and remove the lock afterwards when two commands start together", async () => {
    const root = await setUpTest();
    const { mostAtOnce, task } = countTasksAtOnce();

    await Promise.all([withStartLock(root, task), withStartLock(root, task)]);

    expect(mostAtOnce()).toBe(1);
    await expect(stat(lockPath(root))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("must take over the lock when the process that held it has exited", async () => {
    const root = await setUpTest();
    await writeFile(lockPath(root), String(await findExitedPid()));

    const result = await withStartLock(root, async () => readFile(lockPath(root), "utf8"));

    expect(result).toBe(String(process.pid));
  });

  test("must still run one task at a time when two commands remove an exited process's lock at different speeds", async () => {
    const root = await setUpTest();
    await writeFile(lockPath(root), String(await findExitedPid()));
    removalDelays.push(0, 30);
    const { mostAtOnce, task } = countTasksAtOnce();

    await Promise.all([withStartLock(root, task), withStartLock(root, task)]);

    expect(mostAtOnce()).toBe(1);
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

async function findExitedPid(): Promise<number> {
  const child = spawn(process.execPath, ["--eval", ""]);
  await once(child, "exit");
  return child.pid ?? 0;
}

function countTasksAtOnce() {
  let running = 0;
  let most = 0;
  const task = async (): Promise<void> => {
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 50));
    running -= 1;
  };
  return { mostAtOnce: () => most, task };
}
