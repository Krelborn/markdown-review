import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

import type { ServerFile } from "../../server/runtime/serverFileSchema";
import { serverFileSchema } from "../../server/runtime/serverFileSchema";

import { createGitRepository } from "./createGitRepository";
import type { CliResult, RunningCli } from "./startCli";
import { startCli } from "./startCli";
import { stopReviewServer } from "./stopReviewServer";

export const plan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

export interface ReviewRepository {
  root: string;

  /**
   * Sends a request the way the review page in the browser would
   */
  browser(method: string, url: string, body?: unknown): Promise<Response>;

  readServerFile(): Promise<ServerFile>;
  run(args: string[], input?: string): Promise<CliResult>;
  start(args: string[]): RunningCli;
  writeDocument(document: string, source: string): Promise<void>;
}

/**
 * Registers hooks that give each test a fresh git repository holding `docs/plan.md`, and stop its review server and
 * delete it afterwards
 *
 * @returns a function that returns the running test's repository
 */
export function setUpReviewRepository(): () => ReviewRepository {
  let repository: ReviewRepository | undefined;

  beforeEach(async () => {
    repository = createRepository(await createGitRepository({ "docs/plan.md": plan }));
  });

  afterEach(async () => {
    if (repository !== undefined) {
      await stopReviewServer(repository.root);
      await rm(repository.root, { force: true, recursive: true });
    }
  });

  return () => {
    if (repository === undefined) {
      throw new TypeError("The repository is only available inside a test");
    }
    return repository;
  };
}

function createRepository(root: string): ReviewRepository {
  const readServerFile = async (): Promise<ServerFile> =>
    serverFileSchema.parse(JSON.parse(await readFile(path.join(root, ".markdown-review", "server.json"), "utf8")));
  return {
    browser: async (method, url, body) => {
      const { port } = await readServerFile();
      const origin = `http://127.0.0.1:${port}`;
      return fetch(`${origin}${url}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: { "content-type": "application/json", origin },
        method,
      });
    },
    readServerFile,
    root,
    run: (args, input) => startCli(root, args, input).result,
    start: (args) => startCli(root, args),
    writeDocument: (document, source) => writeFile(path.join(root, ...document.split("/")), source),
  };
}
