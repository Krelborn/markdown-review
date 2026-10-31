import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

import { pollResponseSchema } from "../../shared/api/apiResponseSchemas";
import { documentThreadsFilePath } from "../store/storePaths";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { cacheComment, setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("pollRoutes", () => {
  test("must return at once when a thread already needs the agent", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "revise" });

    const result = pollResponseSchema.parse(await (await agent("GET", "/api/poll?timeout=5")).json());

    expect(result).toMatchObject({ threads: [{ id: 1 }], timedOut: false });
  });

  test("must wait, report the agent waiting, and return the threads when the user submits", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const poll = agent("GET", "/api/poll?timeout=10");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "revise" });
    const result = pollResponseSchema.parse(await (await poll).json());

    expect(result).toMatchObject({ threads: [{ id: 1 }], timedOut: false });
    expect(activity.agentWaiting).toBe(false);
  });

  test("must hand the threads to every waiting poll when two agents poll at once", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const polls = [agent("GET", "/api/poll?timeout=10"), agent("GET", "/api/poll?timeout=10")];
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "revise" });
    const results = await Promise.all(polls.map(async (poll) => pollResponseSchema.parse(await (await poll).json())));

    expect(results.map((result) => result.threads.map((thread) => thread.id))).toEqual([[1], [1]]);
  });

  test("must stop counting the agent as waiting when its poll disconnects", async () => {
    const { activity, agent } = await setUpAppTest(getDirectory());
    const response = await agent("GET", "/api/poll?timeout=10");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));

    await response.body?.cancel();

    await vi.waitFor(() => expect(activity.agentWaiting).toBe(false));
  });

  test.each([{ verdict: "go-ahead" as const }, { verdict: "hand-back" as const }])(
    "must return at once when the user ended the round with $verdict",
    async ({ verdict }) => {
      const { agent, browser } = await setUpAppTest(getDirectory());
      await agent("POST", "/api/agent/open", {});
      await browser("POST", "/api/submit", { verdict });

      const result = pollResponseSchema.parse(await (await agent("GET", "/api/poll?timeout=5")).json());

      expect(result).toMatchObject({ round: { verdict: { kind: verdict } }, threads: [], timedOut: false });
    }
  );

  test("must keep waiting and time out when the submit holds nothing for the polled doc", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });

    const poll = agent("GET", "/api/poll?timeout=1&document=docs/plan.md");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "revise" });
    const result = pollResponseSchema.parse(await (await poll).json());

    expect(result).toMatchObject({ threads: [], timedOut: true });
  });

  test("must refuse a doc that does not exist when no thread is stored on it", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    const response = await agent("GET", "/api/poll?timeout=5&document=docs/nope.md");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { reason: "missing-document" } });
  });

  test("must return the verdict for a deleted doc when its only threads are resolved", async () => {
    const { agent, browser, root } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "revise" });
    await rm(path.join(root, "docs", "plan.md"));
    await agent("POST", "/api/agent/threads/1/resolve", { body: null });
    await browser("POST", "/api/submit", { verdict: "go-ahead" });

    const result = pollResponseSchema.parse(
      await (await agent("GET", "/api/poll?timeout=5&document=docs/plan.md")).json()
    );

    expect(result).toMatchObject({ round: { verdict: { kind: "go-ahead" } }, timedOut: false });
  });

  test("must keep waiting for a doc deleted after the agent opened it, before any thread was made", async () => {
    const { agent, root } = await setUpAppTest(getDirectory());
    await agent("POST", "/api/agent/open", { path: "docs/plan.md" });
    await rm(path.join(root, "docs", "plan.md"));

    const result = pollResponseSchema.parse(
      await (await agent("GET", "/api/poll?timeout=1&document=docs/plan.md")).json()
    );

    expect(result).toMatchObject({ threads: [], timedOut: true });
  });

  test("must return the verdict for a doc deleted after the agent opened it, before any thread was made", async () => {
    const { agent, browser, root } = await setUpAppTest(getDirectory());
    await agent("POST", "/api/agent/open", { path: "docs/plan.md" });
    await rm(path.join(root, "docs", "plan.md"));
    await browser("POST", "/api/submit", { verdict: "go-ahead" });

    const result = pollResponseSchema.parse(
      await (await agent("GET", "/api/poll?timeout=5&document=docs/plan.md")).json()
    );

    expect(result).toMatchObject({ round: { verdict: { kind: "go-ahead" } }, timedOut: false });
  });

  test.each([
    { condition: "is not JSON", content: "{" },
    { condition: "does not have the threads file's shape", content: '{"version":1}' },
  ])(
    "must report the problem and not a mistyped path when the deleted doc's threads file $condition",
    async ({ content }) => {
      const { agent, browser, root } = await setUpAppTest(getDirectory());
      await browser("POST", "/api/threads", cacheComment);
      await browser("POST", "/api/submit", { verdict: "revise" });
      await rm(path.join(root, "docs", "plan.md"));
      const file = documentThreadsFilePath(root, "docs/plan.md");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);

      const response = await agent("GET", "/api/poll?timeout=1&document=docs/plan.md");

      expect(response.status).toBe(200);
      expect(pollResponseSchema.parse(await response.json())).toMatchObject({
        problems: [expect.stringContaining("plan.md.json")],
      });
    }
  );

  test("must write spaces to keep the connection alive while it waits", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    const body = await (await agent("GET", "/api/poll?timeout=1")).text();

    expect(body.startsWith("  ")).toBe(true);
    expect(pollResponseSchema.parse(JSON.parse(body))).toMatchObject({ timedOut: true });
  });

  test("must refuse a timeout when it is not a whole number of seconds", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    expect((await agent("GET", "/api/poll?timeout=soon")).status).toBe(400);
  });
});
