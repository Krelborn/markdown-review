import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createMemoryLogger } from "../server/logging/testing/createMemoryLogger";
import { runServer } from "../server/runtime/runServer";
import { serverFilePath } from "../server/store/storePaths";
import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { CliError } from "./CliError";
import { connectToServer, waitUntilStopped } from "./connectToServer";

const getDirectory = setUpTemporaryDirectory();

const cleanUps: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanUp of cleanUps.splice(0)) {
    await cleanUp();
  }
});

describe("connectToServer", () => {
  test("must connect to the root's running server instead of starting another", async () => {
    const root = await createRoot();
    const server = await runServer({ logger: createMemoryLogger().logger, root });
    cleanUps.push(() => server.close());

    const client = await connectToServer(root, path.join(root, "unused-cli.js"));

    expect(client.port).toBe(server.port);
  });

  test("must refuse to replace a server that speaks a newer protocol", async () => {
    const root = await createRoot();
    await startNewerServer(root);

    await expect(connectToServer(root, path.join(root, "unused-cli.js"))).rejects.toBeInstanceOf(CliError);
  });
});

describe("waitUntilStopped", () => {
  test("must return once the server no longer answers after it has been asked to stop", async () => {
    const root = await createRoot();
    const server = await runServer({ logger: createMemoryLogger().logger, root });
    const client = await connectToServer(root, path.join(root, "unused-cli.js"));

    await client.shutdown();
    await waitUntilStopped(client);

    await expect(client.health()).rejects.toThrow();
    await server.closed;
  });
});

async function createRoot(): Promise<string> {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, ".markdown-review"), { recursive: true });
  return root;
}

async function startNewerServer(root: string): Promise<void> {
  const fake = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ name: "markdown-review", pid: 999_999, protocol: 99, root, version: "9.9.9" }));
  });
  await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
  cleanUps.push(() => new Promise((resolve) => fake.close(() => resolve())));
  const address = fake.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const serverFile = {
    pid: 999_999,
    port,
    protocol: 99,
    root,
    startedAt: new Date().toISOString(),
    token: "b".repeat(64),
    version: "9.9.9",
  };
  await writeFile(serverFilePath(root), JSON.stringify(serverFile));
}
