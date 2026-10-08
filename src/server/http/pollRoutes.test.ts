import { describe, expect, test, vi } from "vitest";

import { pollResponseSchema } from "../../shared/api/apiResponseSchemas";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { cacheComment, setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("pollRoutes", () => {
  test("must return at once when a thread already needs the agent", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "request-changes" });

    const result = pollResponseSchema.parse(await (await agent("GET", "/api/poll?timeout=5")).json());

    expect(result).toMatchObject({ threads: [{ id: 1 }], timedOut: false });
  });

  test("must wait, report the agent waiting, and return the threads when the user submits", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const poll = agent("GET", "/api/poll?timeout=10");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "request-changes" });
    const result = pollResponseSchema.parse(await (await poll).json());

    expect(result).toMatchObject({ threads: [{ id: 1 }], timedOut: false });
    expect(activity.agentWaiting).toBe(false);
  });

  test("must hand the threads to every waiting poll when two agents poll at once", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const polls = [agent("GET", "/api/poll?timeout=10"), agent("GET", "/api/poll?timeout=10")];
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "request-changes" });
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

  test("must return at once when the user has approved the round", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/submit", { verdict: "approve" });

    const result = pollResponseSchema.parse(await (await agent("GET", "/api/poll?timeout=5")).json());

    expect(result).toMatchObject({ review: { approved: true }, threads: [], timedOut: false });
  });

  test("must keep waiting and time out when the submit holds nothing for the polled doc", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });

    const poll = agent("GET", "/api/poll?timeout=1&document=docs/plan.md");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "request-changes" });
    const result = pollResponseSchema.parse(await (await poll).json());

    expect(result).toMatchObject({ threads: [], timedOut: true });
  });

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
