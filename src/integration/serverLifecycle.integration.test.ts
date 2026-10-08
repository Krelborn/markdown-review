import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { createServer } from "node:http";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpReviewRepository } from "./testing/setUpReviewRepository";

const getRepository = setUpReviewRepository();

describe("server lifecycle", () => {
  test("must start exactly one server when several commands run at once", async () => {
    const repository = getRepository();

    const results = await Promise.all([1, 2, 3, 4].map(() => repository.run(["inbox"])));

    expect(results.map(({ exitCode }) => exitCode)).toEqual([0, 0, 0, 0]);
    expect(await countServerStarts(repository.root)).toBe(1);
  });

  test("must keep using the root's server when the next command runs", async () => {
    const repository = getRepository();
    await repository.run(["inbox"]);
    const first = await repository.readServerFile();

    await repository.run(["inbox"]);

    expect((await repository.readServerFile()).pid).toBe(first.pid);
    expect(await countServerStarts(repository.root)).toBe(1);
  });

  test("must start a new server when server.json names one that no longer answers", async () => {
    const repository = getRepository();
    const gone = await listen(createServer());
    await new Promise((resolve) => gone.server.close(resolve));
    await writeServerFile(repository.root, { port: gone.port, protocol: 1 });

    const { exitCode } = await repository.run(["inbox"]);

    expect(exitCode).toBe(0);
    expect((await repository.readServerFile()).port).not.toBe(gone.port);
  });

  test("must shut down a server of an older protocol and start the current one", async () => {
    const repository = getRepository();
    const older = await startFakeServer(repository.root, 0);

    const { exitCode } = await repository.run(["inbox"]);

    expect(exitCode).toBe(0);
    expect(older.shutdownRequested()).toBe(true);
    expect((await repository.readServerFile()).protocol).toBe(1);
  });

  test("must leave a server of a newer protocol running and say how to use it", async () => {
    const repository = getRepository();
    const newer = await startFakeServer(repository.root, 2);

    const { exitCode, stderr } = await repository.run(["inbox"]);
    await newer.close();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("A newer markdown-review (version 9.9.9, protocol 2) is serving");
    expect(stderr).toContain("next_step: Run the newer markdown-review");
    expect(newer.shutdownRequested()).toBe(false);
  });

  test("must stop the server and remove server.json when the agent runs stop", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    const { port } = await repository.readServerFile();

    const { stdout } = await repository.run(["stop"]);

    expect(stdout).toBe(
      `Stopped the review server for ${repository.root}.\n\nnext_step: None; any markdown-review command starts it again.\n`
    );
    await expect(stat(path.join(repository.root, ".markdown-review", "server.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fetch(`http://127.0.0.1:${port}/api/health`)).rejects.toThrow();
  });
});

async function countServerStarts(root: string): Promise<number> {
  const log = await readFile(path.join(root, ".markdown-review", "server.log"), "utf8");
  return log.split("\n").filter((line) => line.includes(" info Serving ")).length;
}

function listen(server: Server): Promise<{ port: number; server: Server }> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ port: typeof address === "object" && address !== null ? address.port : 0, server });
    });
  });
}

async function writeServerFile(root: string, { port, protocol }: { port: number; protocol: number }): Promise<void> {
  const serverFile = {
    pid: 999_999,
    port,
    protocol,
    root,
    startedAt: new Date().toISOString(),
    token: "b".repeat(64),
    version: "9.9.9",
  };
  await mkdir(path.join(root, ".markdown-review"), { recursive: true });
  await writeFile(path.join(root, ".markdown-review", "server.json"), JSON.stringify(serverFile));
}

/**
 * Starts a stand-in for another version's server, recorded in the root's server.json
 */
async function startFakeServer(root: string, protocol: number) {
  let shutdownRequested = false;
  const fake = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/api/health") {
      response.end(JSON.stringify({ name: "markdown-review", pid: 999_999, protocol, root, version: "9.9.9" }));
      return;
    }
    if (request.url === "/api/shutdown") {
      shutdownRequested = true;
      response.end(JSON.stringify({ stopping: true }), () => {
        fake.close();
        fake.closeAllConnections();
      });
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { message: "Not found", reason: "not-found" } }));
  });
  const { port } = await listen(fake);
  await writeServerFile(root, { port, protocol });
  return {
    close: () =>
      new Promise<void>((resolve) => {
        fake.close(() => resolve());
        fake.closeAllConnections();
      }),
    shutdownRequested: () => shutdownRequested,
  };
}
