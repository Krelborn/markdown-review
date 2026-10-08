import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createMemoryLogger } from "../server/logging/testing/createMemoryLogger";
import type { RunningServer } from "../server/runtime/runServer";
import { runServer } from "../server/runtime/runServer";
import { serverFileSchema } from "../server/runtime/serverFileSchema";
import { serverFilePath } from "../server/store/storePaths";
import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { ServerClient } from "./ServerClient";

const getDirectory = setUpTemporaryDirectory();

let running: RunningServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe("ServerClient", () => {
  test("must read the server's health and the inbox when it has the server's token", async () => {
    const { client, root } = await setUpTest();

    expect((await client.health()).root).toBe(root);
    expect(await client.inbox(null)).toMatchObject({ problems: [], threads: [] });
  });

  test("must start a round and return the doc's URL when the agent opens a doc", async () => {
    const { client } = await setUpTest();

    const opened = await client.open("docs/plan.md");

    expect(opened).toMatchObject({ navigated: false, url: `http://127.0.0.1:${client.port}/document/docs/plan.md` });
    expect(opened.review.requestedAt).not.toBeNull();
  });

  test("must return an empty, timed-out inbox when a poll's timeout passes with nothing to do", async () => {
    const { client } = await setUpTest();

    const result = await client.poll(null, 0, new AbortController().signal);

    expect(result).toMatchObject({ threads: [], timedOut: true });
  });

  test("must raise the server's reason when the server refuses a request", async () => {
    const { client } = await setUpTest();

    await expect(client.reply(99, "Done")).rejects.toMatchObject({ reason: "unknown-thread", status: 404 });
  });

  test("must be refused when its token is wrong", async () => {
    const { port } = await setUpTest();

    await expect(new ServerClient(port, "c".repeat(64)).inbox(null)).rejects.toMatchObject({ reason: "unauthorized" });
  });

  test("must stop the server when it asks the server to shut down", async () => {
    const { client, server } = await setUpTest();

    await client.shutdown();

    await expect(server.closed).resolves.toBeUndefined();
  });
});

async function setUpTest() {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  const server = await runServer({ logger: createMemoryLogger().logger, root });
  running = server;
  const { port, token } = serverFileSchema.parse(JSON.parse(await readFile(serverFilePath(root), "utf8")));
  const client = new ServerClient(port, token);
  return { client, port, root, server };
}
