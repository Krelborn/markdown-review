import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { serverLogPath, storeDirectory } from "../server/store/storePaths";

import { CliError } from "./CliError";
import { findServer } from "./findServer";
import type { ServerClient } from "./ServerClient";
import { withStartLock } from "./withStartLock";

const startWaitMilliseconds = 10_000;

const stopWaitMilliseconds = 5_000;

const checkIntervalMilliseconds = 100;

/**
 * Connects to the root's review server, starting one when none is running and replacing one of an older protocol
 *
 * @param root the root's real path
 * @param cliPath the built CLI, which the server is started from
 * @returns a client for the running server
 * @throws CliError when a newer markdown-review is serving the root, or the server does not start
 */
export async function connectToServer(root: string, cliPath: string): Promise<ServerClient> {
  const found = await findServer(root);
  switch (found.kind) {
    case "ready":
      return found.client;
    case "newer":
      throw new CliError(
        `A newer markdown-review (version ${found.health.version}, protocol ${found.health.protocol}) is serving ${root}`,
        "Run the newer markdown-review, for example `npx @krelborn/markdown-review@latest <command>`, or stop its server with it."
      );
    case "older":
      await found.client.shutdown();
      await waitUntilStopped(found.client);
      break;
    case "absent":
      break;
  }
  await mkdir(storeDirectory(root), { recursive: true });
  return withStartLock(root, async () => {
    const recheck = await findServer(root);
    if (recheck.kind === "ready") {
      return recheck.client;
    }
    await spawnServer(root, cliPath);
    return waitUntilReady(root);
  });
}

/**
 * Waits for a server to stop answering, after asking it to shut down
 *
 * @param client the server's client
 */
export async function waitUntilStopped(client: ServerClient): Promise<void> {
  const deadline = Date.now() + stopWaitMilliseconds;
  while (Date.now() < deadline) {
    try {
      await client.health();
    } catch {
      return;
    }
    await delay(checkIntervalMilliseconds);
  }
}

async function spawnServer(root: string, cliPath: string): Promise<void> {
  const log = await open(serverLogPath(root), "a");
  try {
    const child = spawn(process.execPath, [cliPath, "serve", "--root", root], {
      detached: true,
      stdio: ["ignore", log.fd, log.fd],
    });
    child.unref();
  } finally {
    await log.close();
  }
}

async function waitUntilReady(root: string): Promise<ServerClient> {
  const deadline = Date.now() + startWaitMilliseconds;
  while (Date.now() < deadline) {
    const found = await findServer(root);
    if (found.kind === "ready") {
      return found.client;
    }
    await delay(checkIntervalMilliseconds);
  }
  throw new CliError(
    `The review server for ${root} did not start within 10 seconds`,
    `Read ${serverLogPath(root)}, fix what it reports, and run the command again.`
  );
}
