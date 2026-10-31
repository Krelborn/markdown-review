import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import type { Health } from "../shared/api/apiResponseSchemas";
import { serverFilePath, serverLogPath, storeDirectory } from "../server/store/storePaths";

import { CliError } from "./CliError";
import { findServer } from "./findServer";
import type { ServerClient } from "./ServerClient";
import { ServerRequestError } from "./ServerRequestError";
import { withStartLock } from "./withStartLock";

const startWaitMilliseconds = 10_000;

const stopWaitMilliseconds = 5_000;

const shutdownWaitMilliseconds = 2_000;

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
  if (found.kind === "ready") {
    return found.client;
  }
  if (found.kind === "newer") {
    throw newerServerError(root, found.health);
  }
  await mkdir(storeDirectory(root), { recursive: true });
  // An older server is replaced under the lock, so that of the commands that find it, one replaces it and the others
  // use the server it starts. Another command may have changed things while this one waited, so look again.
  return withStartLock(root, async () => {
    const recheck = await findServer(root);
    switch (recheck.kind) {
      case "ready":
        return recheck.client;
      case "newer":
        throw newerServerError(root, recheck.health);
      case "older":
        await stopServer(recheck.client, root);
        break;
      case "absent":
        break;
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

function newerServerError(root: string, health: Health): CliError {
  return new CliError(
    `A newer markdown-review (version ${health.version}, protocol ${health.protocol}) is serving ${root}`,
    "Run the newer markdown-review, for example `npx @krelborn/markdown-review@latest <command>`, or stop its server with it."
  );
}

/**
 * Asks a server to shut down and waits for it to stop. A server that closes its connections as it stops may cut off
 * the reply to the request, which counts as a success once the server's port refuses connections. Any other failure
 * leaves it unknown whether the server stopped, so it is reported rather than risk a second server on the store.
 *
 * @throws ServerRequestError when the server refused to shut down
 * @throws CliError when the server did not answer, or may still be running after the request failed
 */
async function stopServer(client: ServerClient, root: string): Promise<void> {
  try {
    await client.shutdown(AbortSignal.timeout(shutdownWaitMilliseconds));
  } catch (error) {
    if (error instanceof ServerRequestError) {
      throw error;
    }
    if (isTimeout(error) || !(await portRefusesConnections(client))) {
      throw new CliError(
        `The review server for ${root} is of an older version and could not be stopped to start the current one`,
        `Run the command again. If it fails again, stop the process named in ${serverFilePath(root)}, then run the command once more.`
      );
    }
    return;
  }
  await waitUntilStopped(client);
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

/**
 * Tells whether nothing listens on the server's port any more. A server that still answers is given the time
 * `waitUntilStopped` gives one; any other failure, such as a timeout or an HTTP error, does not show the listener is gone.
 */
async function portRefusesConnections(client: ServerClient): Promise<boolean> {
  const deadline = Date.now() + stopWaitMilliseconds;
  while (Date.now() < deadline) {
    try {
      await client.health();
    } catch (error) {
      return isConnectionRefused(error);
    }
    await delay(checkIntervalMilliseconds);
  }
  return false;
}

function isConnectionRefused(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    error.cause instanceof Error &&
    "code" in error.cause &&
    error.cause.code === "ECONNREFUSED"
  );
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
