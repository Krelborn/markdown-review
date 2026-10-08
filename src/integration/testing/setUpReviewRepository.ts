import type { ChildProcess } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach } from "vitest";

import type { ServerFile } from "../../server/runtime/serverFileSchema";
import { serverFileSchema } from "../../server/runtime/serverFileSchema";

const runCommand = promisify(execFile);

const cliPath = fileURLToPath(new URL("../../../dist/cli.js", import.meta.url));

export const plan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

export interface CliResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

export interface RunningCli {
  child: ChildProcess;
  result: Promise<CliResult>;

  /**
   * Resolves once the command has written `text` to standard error
   */
  printedToStderr(text: string): Promise<void>;
}

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
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "markdown-review-integration-"));
    const root = await realpath(directory);
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "plan.md"), plan);
    await runCommand("git", ["init", "-q"], { cwd: root });
    repository = createRepository(root);
  });

  afterEach(async () => {
    if (repository !== undefined) {
      await stopServer(repository);
    }
    await rm(directory, { force: true, recursive: true });
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
  const start = (args: string[], input?: string): RunningCli => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: root,
      env: { ...process.env, MARKDOWN_REVIEW_NO_BROWSER: "1" },
    });
    let stdout = "";
    let stderr = "";
    const stderrWaiters: { resolve: () => void; text: string }[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      for (const waiter of stderrWaiters.filter(({ text }) => stderr.includes(text))) {
        waiter.resolve();
      }
    });
    child.stdin.end(input ?? "");
    const result = new Promise<CliResult>((resolve) => {
      child.on("close", (exitCode) => resolve({ exitCode, stderr, stdout }));
    });
    const printedToStderr = (text: string): Promise<void> =>
      new Promise((resolve) => {
        if (stderr.includes(text)) {
          resolve();
          return;
        }
        stderrWaiters.push({ resolve, text });
      });
    return { child, printedToStderr, result };
  };
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
    run: (args, input) => start(args, input).result,
    start: (args) => start(args),
    writeDocument: (document, source) => writeFile(path.join(root, ...document.split("/")), source),
  };
}

async function stopServer(repository: ReviewRepository): Promise<void> {
  await repository.run(["stop"]);
  const recorded = await repository.readServerFile().catch(() => null);
  if (recorded !== null && recorded.pid !== process.pid) {
    try {
      process.kill(recorded.pid);
    } catch {
      return;
    }
  }
}
