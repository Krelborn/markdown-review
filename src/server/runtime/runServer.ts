import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";

import { getRequestListener } from "@hono/node-server";

import { protocolVersion } from "../../shared/api/protocolVersion";
import { BrowserTabs } from "../events/BrowserTabs";
import { ServerEvents } from "../events/ServerEvents";
import { readTextFileOrNull } from "../files/readTextFileOrNull";
import { writeJsonAtomically } from "../files/writeJsonAtomically";
import { createApp } from "../http/createApp";
import { RecentDocuments } from "../http/RecentDocuments";
import type { Logger } from "../logging/Logger";
import { ReviewStore } from "../store/ReviewStore";
import { serverFilePath } from "../store/storePaths";

import { ActivityMonitor } from "./ActivityMonitor";
import { DocumentWatcher } from "./DocumentWatcher";
import { packageVersion } from "./packageVersion";
import { preferredPort } from "./preferredPort";
import type { ServerFile } from "./serverFileSchema";
import { serverFileSchema } from "./serverFileSchema";

export interface RunServerOptions {
  root: string;
  logger: Logger;

  /**
   * How long the server stays up with no connected tab, no waiting poll and no request
   */
  idleMilliseconds?: number;

  pollKeepAliveMilliseconds?: number;
}

export interface RunningServer {
  port: number;

  /**
   * Resolves once the server has stopped, whether through `close`, the idle timeout or a shutdown request
   */
  closed: Promise<void>;

  close(): Promise<void>;
}

/**
 * Starts the root's review server on 127.0.0.1 and records it in `.markdown-review/server.json`
 *
 * @returns the running server; it removes `server.json` when it stops
 */
export async function runServer({
  idleMilliseconds = 30 * 60_000,
  logger,
  pollKeepAliveMilliseconds = 15_000,
  root,
}: RunServerOptions): Promise<RunningServer> {
  const store = new ReviewStore(root, logger);
  await store.initialize();
  const events = new ServerEvents();
  let port = 0;
  let stopping: Promise<void> | undefined;
  let markClosed = (): void => {};
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve;
  });
  const close = (): Promise<void> => {
    stopping ??= stop();
    return stopping;
  };
  const closeInBackground = (): void => {
    close().catch((error: unknown) => logger.error("The server did not stop cleanly", error));
  };
  const activity = new ActivityMonitor({ events, idleMilliseconds, onIdle: closeInBackground });
  const watcher = new DocumentWatcher(root, (document) => {
    store
      .readThreads(document)
      .then(() => {
        events.publish({ document, type: "document-changed" });
        events.publish({ type: "threads-changed" });
      })
      .catch((error: unknown) => logger.warn(`Could not re-anchor ${document} after it changed`, error));
  });
  const token = randomBytes(32).toString("hex");
  const app = createApp({
    activity,
    events,
    logger,
    pollKeepAliveMilliseconds,
    port: () => port,
    recentDocuments: new RecentDocuments(),
    root,
    shutdown: closeInBackground,
    store,
    tabs: new BrowserTabs(),
    token,
    version: packageVersion,
    watchDocument: (document) => watcher.watch(document),
  });
  const server = createServer(getRequestListener(app.fetch));
  port = await listen(server, preferredPort(root));
  const serverFile: ServerFile = {
    pid: process.pid,
    port,
    protocol: protocolVersion,
    root,
    startedAt: new Date().toISOString(),
    token,
    version: packageVersion,
  };
  await writeJsonAtomically(serverFilePath(root), serverFile, 0o600);
  for (const thread of (await store.readThreads(null)).threads) {
    if (thread.anchor.kind !== "review") {
      watcher.watch(thread.anchor.document);
    }
  }
  logger.info(`Serving ${root} on http://127.0.0.1:${port}`);

  async function stop(): Promise<void> {
    activity.stop();
    await watcher.close();
    await closeServer(server);
    await removeServerFile(root);
    logger.info("Stopped");
    markClosed();
  }

  return { close, closed, port };
}

async function listen(server: Server, port: number): Promise<number> {
  try {
    return await listenOn(server, port);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      return listenOn(server, 0);
    }
    throw error;
  }
}

function listenOn(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new TypeError("The server is not listening on a TCP port"));
        return;
      }
      resolve(address.port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
    server.closeAllConnections();
  });
}

/**
 * Removes `server.json` unless a newer server has already replaced it
 */
async function removeServerFile(root: string): Promise<void> {
  const contents = await readTextFileOrNull(serverFilePath(root));
  if (contents === null) {
    return;
  }
  let recorded: unknown;
  try {
    recorded = JSON.parse(contents);
  } catch {
    return;
  }
  if (serverFileSchema.safeParse(recorded).data?.pid === process.pid) {
    await rm(serverFilePath(root), { force: true });
  }
}
