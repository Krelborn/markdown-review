import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { healthSchema } from "../../shared/api/apiResponseSchemas";
import { readServerSentEvents } from "../http/testing/readServerSentEvents";
import { createMemoryLogger } from "../logging/testing/createMemoryLogger";
import { serverFilePath } from "../store/storePaths";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { preferredPort } from "./preferredPort";
import type { RunningServer } from "./runServer";
import { runServer } from "./runServer";
import { serverFileSchema } from "./serverFileSchema";

const getDirectory = setUpTemporaryDirectory();

const cleanUps: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanUp of cleanUps.splice(0)) {
    await cleanUp();
  }
});

describe("runServer", () => {
  test("must record itself in a private server.json and answer on that port when it starts", async () => {
    const { root, server } = await setUpTest();

    const recorded = serverFileSchema.parse(JSON.parse(await readFile(serverFilePath(root), "utf8")));
    const health = healthSchema.parse(await (await fetch(`http://127.0.0.1:${recorded.port}/api/health`)).json());

    expect(recorded).toMatchObject({ pid: process.pid, port: server.port, protocol: 1, root });
    expect((await stat(serverFilePath(root))).mode & 0o777).toBe(0o600);
    expect(health.root).toBe(root);
  });

  test("must remove server.json when it stops", async () => {
    const { root, server } = await setUpTest();

    await server.close();

    await expect(stat(serverFilePath(root))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("must listen on another port when its preferred port is taken", async () => {
    const root = await createRepository();
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(preferredPort(root), "127.0.0.1", resolve));
    cleanUps.push(() => new Promise((resolve) => blocker.close(() => resolve())));

    const { server } = await setUpTest({ root });

    expect(server.port).not.toBe(preferredPort(root));
  });

  test("must stop itself when nothing has used it for the idle period", async () => {
    const { server } = await setUpTest({ idleMilliseconds: 50 });

    await expect(server.closed).resolves.toBeUndefined();
  });

  test("must tell connected tabs when a doc with comments is edited", async () => {
    const { root, server } = await setUpTest();
    const origin = `http://127.0.0.1:${server.port}`;
    await fetch(`${origin}/api/threads`, {
      body: JSON.stringify({ anchor: { document: "docs/plan.md", kind: "document" }, body: "Doc?" }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    });
    const events = readServerSentEvents(await fetch(`${origin}/api/events`));
    await events.next(1);

    await writeFile(path.join(root, "docs", "plan.md"), "# Plan, edited\n");

    expect(await events.next(2)).toEqual([
      { data: { document: "docs/plan.md" }, event: "document-changed" },
      { data: {}, event: "threads-changed" },
    ]);
    await events.close();
  });
});

async function setUpTest({ idleMilliseconds, root }: { idleMilliseconds?: number; root?: string } = {}): Promise<{
  root: string;
  server: RunningServer;
}> {
  const repositoryRoot = root ?? (await createRepository());
  const server = await runServer({ idleMilliseconds, logger: createMemoryLogger().logger, root: repositoryRoot });
  cleanUps.unshift(() => server.close());
  return { root: repositoryRoot, server };
}

async function createRepository(): Promise<string> {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  return root;
}
