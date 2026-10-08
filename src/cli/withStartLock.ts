import { readFile, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { serverLockPath } from "../server/store/storePaths";

import { CliError } from "./CliError";

const lockWaitMilliseconds = 15_000;

const lockRetryMilliseconds = 100;

/**
 * Runs a task while holding `.markdown-review/server.lock`, so only one command at a time starts the root's server
 *
 * @param root the root's real path; its `.markdown-review/` directory must exist
 * @param task what to do while holding the lock
 * @returns the task's result
 * @throws CliError when another live process holds the lock for longer than 15 seconds
 */
export async function withStartLock<Result>(root: string, task: () => Promise<Result>): Promise<Result> {
  const lockPath = serverLockPath(root);
  const deadline = Date.now() + lockWaitMilliseconds;
  while (!(await tryCreateLock(lockPath))) {
    if (await isStaleLock(lockPath)) {
      await rm(lockPath, { force: true });
    } else if (Date.now() > deadline) {
      throw new CliError(
        `Another markdown-review command has been starting the server for ${root} for over 15 seconds`,
        `Wait for it to finish, or delete ${lockPath} if no other markdown-review command is running, then try again.`
      );
    } else {
      await delay(lockRetryMilliseconds);
    }
  }
  try {
    return await task();
  } finally {
    await rm(lockPath, { force: true });
  }
}

async function tryCreateLock(lockPath: string): Promise<boolean> {
  try {
    await writeFile(lockPath, String(process.pid), { flag: "wx" });
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

/**
 * Tells whether the lock's owner has exited without removing it
 */
async function isStaleLock(lockPath: string): Promise<boolean> {
  let owner: number;
  try {
    owner = Number(await readFile(lockPath, "utf8"));
  } catch {
    return false;
  }
  if (!Number.isInteger(owner) || owner <= 0) {
    return false;
  }
  try {
    process.kill(owner, 0);
    return false;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ESRCH";
  }
}
