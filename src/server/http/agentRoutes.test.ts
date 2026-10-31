import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

import { agentOpenResponseSchema, agentThreadResponseSchema } from "../../shared/api/apiResponseSchemas";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { cacheComment, setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("agentRoutes", () => {
  test("must start a round and return the doc's URL without navigating when no tab is connected", async () => {
    const { agent, recentDocuments } = await setUpAppTest(getDirectory());

    const response = agentOpenResponseSchema.parse(
      await (await agent("POST", "/api/agent/open", { path: "docs/plan.md" })).json()
    );

    expect(response).toMatchObject({ navigated: false, url: "http://127.0.0.1:4321/document/docs/plan.md" });
    expect(response.round?.documents).toEqual(["docs/plan.md"]);
    expect(recentDocuments.list()).toEqual(["docs/plan.md"]);
  });

  test("must send the doc to the latest tab when a tab is connected", async () => {
    const { agent, tabs } = await setUpAppTest(getDirectory());
    const shown: string[] = [];
    tabs.connect({ navigate: (url) => shown.push(url) });

    const response = await agent("POST", "/api/agent/open", { path: "docs/plan.md" });

    expect(await response.json()).toMatchObject({ navigated: true });
    expect(shown).toEqual(["http://127.0.0.1:4321/document/docs/plan.md"]);
  });

  test("must encode the doc's path in the URL when its name has spaces and non-ASCII characters", async () => {
    const { agent, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(root, "docs", "Design Notes café.md"), "# Notes\n");

    const response = await agent("POST", "/api/agent/open", { path: "docs/Design Notes café.md" });

    expect(await response.json()).toMatchObject({
      url: "http://127.0.0.1:4321/document/docs/Design%20Notes%20caf%C3%A9.md",
    });
  });

  test("must refuse to open a doc when it does not exist", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    const response = await agent("POST", "/api/agent/open", { path: "docs/missing.md" });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { reason: "missing-document" } });
  });

  test("must list the threads that need the agent when the CLI reads the inbox", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "revise" });

    const response = await agent("GET", "/api/inbox");

    expect(await response.json()).toMatchObject({ threads: [{ id: 1, status: "open" }] });
  });

  test("must refuse the inbox of a doc that does not exist when no thread is stored on it", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    const response = await agent("GET", "/api/inbox?document=docs/nope.md");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { reason: "missing-document" } });
  });

  test("must list the threads of a doc that was deleted during the review", async () => {
    const { agent, browser, root } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "revise" });
    await rm(path.join(root, "docs", "plan.md"));

    const response = await agent("GET", "/api/inbox?document=docs/plan.md");

    expect(await response.json()).toMatchObject({ threads: [{ id: 1 }] });
  });

  test("must accept the inbox of a deleted doc when its only threads are resolved", async () => {
    const { agent, browser, root } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "revise" });
    await rm(path.join(root, "docs", "plan.md"));
    await agent("POST", "/api/agent/threads/1/resolve", { body: null });

    const response = await agent("GET", "/api/inbox?document=docs/plan.md");

    expect(response.status).toBe(200);
  });

  test("must return the thread and the remaining inbox when the agent resolves a thread", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });
    await browser("POST", "/api/submit", { verdict: "revise" });

    const response = agentThreadResponseSchema.parse(
      await (await agent("POST", "/api/agent/threads/1/resolve", { body: "Changed to 1h" })).json()
    );

    expect(response.thread.status).toBe("resolved");
    expect(response.inbox.threads.map((thread) => thread.id)).toEqual([2]);
  });

  test("must report a draft as unknown when the agent replies to it", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const response = await agent("POST", "/api/agent/threads/1/reply", { body: "Hello" });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { reason: "unknown-thread" } });
  });

  test("must shut the server down shortly after answering when the CLI asks it to stop", async () => {
    const { agent, shutdownCount } = await setUpAppTest(getDirectory());

    const response = await agent("POST", "/api/shutdown");

    expect(await response.json()).toEqual({ stopping: true });
    await vi.waitFor(() => expect(shutdownCount()).toBe(1));
  });
});
